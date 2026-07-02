import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { mediaUrl } from '../../utils/media';

const POLL_INTERVAL = 3000;

function padTwo(n) { return String(n).padStart(2, '0'); }
function formatElapsed(ms) {
  if (ms <= 0) return '00:00';
  const s = Math.floor(ms / 1000);
  return `${padTwo(Math.floor(s / 60))}:${padTwo(s % 60)}`;
}

export default function PanditAstrology() {
  const navigate = useNavigate();
  const [profile, setProfile]             = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [toggling, setToggling]           = useState(false);

  const [session, setSession]             = useState(null);
  const [sessionLoading, setSessLoading]  = useState(true);
  const [messages, setMessages]           = useState([]);
  const [newMsg, setNewMsg]               = useState('');
  const [sending, setSending]             = useState(false);
  const [imgFile, setImgFile]             = useState(null);
  const [imgPreview, setImgPreview]       = useState('');
  const [sendingImg, setSendingImg]       = useState(false);
  const imgInputRef                       = useRef(null);
  const [ending, setEnding]               = useState(false);
  const [requests, setRequests]           = useState([]);

  const [elapsed, setElapsed]             = useState(0);
  const [rejoinedSession, setRejoinedSession] = useState(false);
  const timerRef                          = useRef(null);
  const pollRef                           = useRef(null);
  const lastMsgTime                       = useRef(null);
  const messagesEnd                       = useRef(null);

  const [history, setHistory]             = useState([]);
  const [histLoading, setHistLoading]     = useState(false);
  const [tab, setTab]                     = useState('live');

  /* ── load pandit profile ── */
  useEffect(() => {
    api.get('/pandits/profile')
      .then(({ data }) => setProfile(data.data))
      .catch(() => {})
      .finally(() => setProfileLoading(false));

    // check if pandit has an active session (rejoin if so)
    api.get('/astro/pandit/session/active')
      .then(({ data }) => {
        if (data.data) {
          setSession(data.data);
          setMessages(data.data.messages || []);
          lastMsgTime.current = data.data.messages?.slice(-1)[0]?.createdAt || null;
          // Show "Welcome Back" banner if returning to an in-progress session
          if (['active', 'expired', 'accepted'].includes(data.data.status)) {
            setRejoinedSession(true);
            setTimeout(() => setRejoinedSession(false), 6000);
          }
        }
      })
      .catch(() => {})
      .finally(() => setSessLoading(false));

    // load incoming requests
    api.get('/astro/pandit/requests')
      .then(({ data }) => setRequests(data.data || []))
      .catch(() => {});
  }, []);

  /* ── scroll ── */
  useEffect(() => { messagesEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  /* ── timer when session is active ── */
  useEffect(() => {
    clearInterval(timerRef.current);
    if (session?.status === 'active' && session?.startTime) {
      const tick = () => setElapsed(Math.floor((Date.now() - new Date(session.startTime).getTime()) / 1000));
      tick();
      timerRef.current = setInterval(tick, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [session?.status, session?.startTime]);

  /* ── polling ── */
  const pollSession = useCallback(async () => {
    if (!session?._id) return;
    try {
      const since = lastMsgTime.current ? `?since=${encodeURIComponent(lastMsgTime.current)}` : '';
      const { data } = await api.get(`/astro/session/${session._id}/messages${since}`);
      const { messages: newMsgs, status, paidUntil } = data.data;

      if (newMsgs?.length) {
        setMessages((prev) => [...prev, ...newMsgs]);
        lastMsgTime.current = newMsgs.slice(-1)[0].createdAt;
      }

      if (status !== session.status) {
        setSession((prev) => ({ ...prev, status, paidUntil }));
        if (status === 'active')  toast.success('💳 User paid! Chat is now live.');
        if (status === 'expired') toast('⏰ User\'s 10 minutes are up. Waiting for recharge…', { icon: '⏰' });
        if (status === 'ended') {
          clearInterval(pollRef.current);
          clearInterval(timerRef.current);
          toast('Session ended by user.', { icon: '👋' });
        }
      }
      // Also check paidUntil updated (recharge)
      if (paidUntil && paidUntil !== session.paidUntil) {
        if (status === 'active') toast.success('🔄 User recharged! 10 more minutes.');
        setSession((prev) => ({ ...prev, paidUntil }));
      }
    } catch { /* ignore */ }
  }, [session?._id, session?.status, session?.paidUntil]);

  useEffect(() => {
    clearInterval(pollRef.current);
    if (session && ['active', 'accepted', 'expired'].includes(session.status)) {
      pollRef.current = setInterval(pollSession, POLL_INTERVAL);
    }
    return () => clearInterval(pollRef.current);
  }, [session?._id, session?.status, pollSession]);

  /* ── toggle live ── */
  const toggleLive = async () => {
    setToggling(true);
    try {
      const { data } = await api.put('/astro/pandit/toggle-live');
      setProfile((prev) => ({ ...prev, isLiveNow: data.data.isLiveNow }));
      toast.success(data.message);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update live status.');
    } finally {
      setToggling(false);
    }
  };

  /* ── accept request ── */
  const handleAccept = async (sessionId) => {
    try {
      const { data } = await api.put(`/astro/pandit/session/${sessionId}/accept`);
      // Update session status to accepted; keep existing populated fields if not returned
      setSession((prev) => ({
        ...prev,
        ...data.data,
        userId: data.data.userId || prev?.userId,
        panditId: data.data.panditId || prev?.panditId,
      }));
      setMessages([]);
      setRequests([]);
      toast.success('✅ Accepted! Waiting for user to pay ₹' + (10 * (data.data.ratePerMinute || 0)) + '.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not accept.');
    }
  };

  /* ── reject request ── */
  const handleReject = async (sessionId) => {
    try {
      await api.put(`/astro/pandit/session/${sessionId}/reject`);
      setRequests((prev) => prev.filter((r) => r._id !== sessionId));
      // If the session itself was the one shown, clear it
      if (session?._id === sessionId) {
        setSession(null);
        setMessages([]);
      }
      toast.success('Request rejected.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not reject.');
    }
  };

  /* ── send text message ── */
  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMsg.trim() || !session) return;
    setSending(true);
    try {
      const { data } = await api.post(`/astro/session/${session._id}/message`, { text: newMsg.trim() });
      setMessages((prev) => [...prev, data.data]);
      lastMsgTime.current = data.data.createdAt;
      setNewMsg('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not send message.');
    } finally {
      setSending(false);
    }
  };

  /* ── select image ── */
  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5 MB.'); return; }
    setImgFile(file);
    setImgPreview(URL.createObjectURL(file));
    e.target.value = '';
  };

  /* ── send image ── */
  const handleSendImage = async () => {
    if (!imgFile || !session) return;
    setSendingImg(true);
    try {
      const form = new FormData();
      form.append('image', imgFile);
      if (newMsg.trim()) form.append('caption', newMsg.trim());
      const { data } = await api.post(`/astro/session/${session._id}/image`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMessages((prev) => [...prev, data.data]);
      lastMsgTime.current = data.data.createdAt;
      setImgFile(null);
      setImgPreview('');
      setNewMsg('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not send image.');
    } finally {
      setSendingImg(false);
    }
  };

  const clearImage = () => {
    setImgFile(null);
    if (imgPreview) URL.revokeObjectURL(imgPreview);
    setImgPreview('');
  };

  /* ── end session ── */
  const handleEnd = async () => {
    if (!session) return;
    // Warn if user still has paid time remaining
    const remaining = session.paidUntil ? Math.max(0, new Date(session.paidUntil).getTime() - Date.now()) : 0;
    const confirmMsg = remaining > 30000
      ? `⚠️ User still has ${formatElapsed(remaining)} of paid time left!\n\nEnding the session now will close it permanently for both of you.\n\nClick OK to end, or Cancel to go back.`
      : 'End this chat session?';
    if (!window.confirm(confirmMsg)) return;
    setEnding(true);
    try {
      await api.put(`/astro/session/${session._id}/end`);
      setSession((prev) => ({ ...prev, status: 'ended' }));
      clearInterval(pollRef.current);
      clearInterval(timerRef.current);
      toast.success('Session ended.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not end session.');
    } finally {
      setEnding(false);
    }
  };

  /* ── load history ── */
  const loadHistory = async () => {
    setTab('history');
    setHistLoading(true);
    try {
      const { data } = await api.get('/astro/pandit/sessions/history');
      setHistory(data.data);
    } catch { /* ignore */ } finally {
      setHistLoading(false);
    }
  };

  /* ── derived ── */
  const timeRemaining = session?.paidUntil
    ? Math.max(0, new Date(session.paidUntil).getTime() - Date.now())
    : 0;
  const isExpiring = session?.status === 'active' && timeRemaining > 0 && timeRemaining < 60000;

  if (profileLoading) return <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>;

  if (!profile?.isAstrologer) {
    return (
      <div className="max-w-sm mx-auto mt-8">
        <div className="bg-white rounded-3xl shadow border border-gray-100 text-center py-12 px-6">
          <p className="text-6xl mb-3">🔮</p>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Astrology Not Enabled</h2>
          <p className="text-sm text-gray-500 mb-1">Your account is not enabled for live astrology chat.</p>
          <p className="text-sm text-amber-600 font-semibold">Please contact Admin to enable this feature and set your rate.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8">

      {/* ── HEADER ── */}
      <div className="bg-gradient-to-br from-violet-700 via-purple-600 to-indigo-600 rounded-3xl p-5 text-white">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-4xl">🔮</span>
          <div>
            <h1 className="text-xl font-bold">Astrology Chat</h1>
            <p className="text-purple-200 text-sm">Rate: ₹{profile?.astroRate}/min • ₹{10 * profile?.astroRate} per 10 min</p>
          </div>
        </div>

        {/* BIG live toggle */}
        <div className="bg-black/15 rounded-2xl p-3">
          <p className="text-white/80 text-xs text-center mb-2">Kya aap abhi online hain?</p>
          <button
            onClick={toggleLive}
            disabled={toggling}
            className={`w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-3 active:scale-95 ${
              profile?.isLiveNow
                ? 'bg-green-500 hover:bg-green-400 text-white shadow-lg'
                : 'bg-white/20 hover:bg-white/30 text-white border-2 border-dashed border-white/50'
            }`}
          >
            {toggling ? '⏳ Updating…'
              : profile?.isLiveNow
              ? <><span className="text-xl">🟢</span> LIVE — Users Can Chat You</>
              : <><span className="text-xl">🔴</span> OFFLINE — Tap to Go Live</>}
          </button>
          <p className="text-white/60 text-xs text-center mt-1.5">
            {profile?.isLiveNow ? 'Users can see and request you' : 'Turn ON to start receiving requests'}
          </p>
        </div>
      </div>

      {/* tabs */}
      <div className="flex gap-2">
        {[
          { key: 'live',    label: `💬 Live${requests.length > 0 ? ` (${requests.length})` : ''}` },
          { key: 'history', label: '📜 History' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => key === 'history' ? loadHistory() : setTab(key)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${tab === key ? 'bg-violet-600 text-white shadow' : 'bg-white text-gray-600 border border-gray-200 hover:border-violet-300'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════
          TAB: LIVE
      ══════════════════════════════════════ */}
      {tab === 'live' && (
        <div className="space-y-3">

          {/* ── Incoming requests (no active session) ── */}
          {!session && (
            <>
              {sessionLoading ? (
                <div className="flex justify-center py-6"><LoadingSpinner /></div>
              ) : requests.length === 0 ? (
                <div className="bg-gray-50 border border-gray-100 rounded-2xl text-center py-10">
                  <p className="text-4xl mb-2">😴</p>
                  <p className="text-gray-500 font-semibold">
                    {profile?.isLiveNow ? 'No requests yet — users will appear here' : 'Go LIVE to receive requests'}
                  </p>
                  {profile?.isLiveNow && <p className="text-xs text-gray-400 mt-1">This page refreshes automatically</p>}
                </div>
              ) : (
                requests.map((r) => (
                  <div key={r._id} className="bg-white border-2 border-amber-200 rounded-2xl overflow-hidden">
                    <div className="bg-amber-400 px-4 py-2 flex items-center gap-2">
                      <span className="text-lg animate-bounce">🔔</span>
                      <p className="font-bold text-amber-900 text-sm">New Chat Request!</p>
                      <span className="ml-auto text-xs text-amber-800 font-semibold">
                        {new Date(r.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="p-4 flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center text-2xl overflow-hidden flex-shrink-0">
                        {r.userId?.profilePhoto
                          ? <img src={r.userId.profilePhoto} alt="" className="w-full h-full object-cover rounded-xl" />
                          : '👤'}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{r.userId?.name}</p>
                        <p className="text-xs text-gray-500">Wants to chat • ₹{r.ratePerMinute}/min</p>
                      </div>
                    </div>
                    <div className="px-4 pb-4 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleAccept(r._id)}
                        className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl text-sm transition-colors active:scale-95"
                      >
                        ✅ Accept
                      </button>
                      <button
                        onClick={() => handleReject(r._id)}
                        className="bg-red-100 hover:bg-red-200 text-red-700 font-bold py-3 rounded-xl text-sm transition-colors active:scale-95"
                      >
                        ❌ Reject
                      </button>
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {/* ── Active session ── */}
          {session && (
            <>
              {/* ── WELCOME BACK BANNER ── */}
              {rejoinedSession && (
                <div className="bg-green-500 text-white rounded-2xl px-4 py-3 flex items-center gap-3">
                  <span className="text-2xl">🔄</span>
                  <div className="flex-1">
                    <p className="font-bold text-sm">Welcome Back!</p>
                    <p className="text-xs text-green-100">
                      {session.status === 'active'
                        ? 'Your chat session is still live — user\'s timer is running'
                        : session.status === 'expired'
                        ? 'User\'s time is up — waiting for them to recharge'
                        : 'Your session is still open'}
                    </p>
                  </div>
                  <button
                    onClick={() => setRejoinedSession(false)}
                    className="text-green-200 hover:text-white text-lg flex-shrink-0"
                  >✕</button>
                </div>
              )}

              {/* User info + session status */}
              <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center text-2xl overflow-hidden flex-shrink-0">
                  {session.userId?.profilePhoto
                    ? <img src={session.userId.profilePhoto} alt="" className="w-full h-full object-cover rounded-xl" />
                    : '👤'}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-900">{session.userId?.name}</p>
                  <p className="text-xs text-gray-500">₹{session.ratePerMinute}/min • ₹{10 * session.ratePerMinute} per block</p>
                </div>
                <span className={`text-xs font-bold px-3 py-1.5 rounded-full flex-shrink-0 ${
                  session.status === 'accepted' ? 'bg-blue-100 text-blue-700' :
                  session.status === 'active'   ? 'bg-green-100 text-green-700' :
                  session.status === 'expired'  ? 'bg-orange-100 text-orange-700' :
                  session.status === 'ended'    ? 'bg-gray-100 text-gray-600' :
                  'bg-amber-100 text-amber-700'
                }`}>
                  {session.status === 'accepted' ? '⏳ Awaiting Payment' :
                   session.status === 'active'   ? '🟢 Chat Live' :
                   session.status === 'expired'  ? '⏰ Awaiting Recharge' :
                   session.status === 'ended'    ? '⏹ Ended' : session.status}
                </span>
              </div>

              {/* STATUS: WAITING — show accept / reject buttons */}
              {session.status === 'waiting' && (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl overflow-hidden">
                  <div className="bg-amber-400 px-4 py-3 flex items-center gap-2">
                    <span className="text-2xl animate-bounce">🔔</span>
                    <div>
                      <p className="font-bold text-amber-900 text-base">New Chat Request!</p>
                      <p className="text-xs text-amber-800">User wants to talk to you</p>
                    </div>
                    <span className="ml-auto text-xs text-amber-900 font-semibold bg-amber-200 px-2 py-1 rounded-lg">
                      {new Date(session.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="p-4">
                    <div className="bg-white rounded-2xl p-4 mb-4 border border-amber-100">
                      <p className="text-xs text-gray-500 font-semibold mb-2">What happens next?</p>
                      <div className="space-y-1.5 text-sm text-gray-600">
                        <p>✅ <strong>Accept</strong> → User will pay ₹{10 * session.ratePerMinute} for 10 min → Chat starts</p>
                        <p>❌ <strong>Reject</strong> → Request is declined, user will see a message</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => handleAccept(session._id)}
                        className="bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-2xl text-base transition-colors active:scale-95 flex items-center justify-center gap-2"
                      >
                        <span className="text-xl">✅</span> Accept
                      </button>
                      <button
                        onClick={() => handleReject(session._id)}
                        className="bg-red-100 hover:bg-red-200 text-red-700 font-bold py-4 rounded-2xl text-base transition-colors active:scale-95 flex items-center justify-center gap-2"
                      >
                        <span className="text-xl">❌</span> Reject
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* STATUS: ACCEPTED — waiting for user to pay */}
              {session.status === 'accepted' && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-center">
                  <div className="text-3xl mb-2 animate-pulse">💳</div>
                  <p className="font-bold text-blue-800 text-base">Waiting for User to Pay</p>
                  <p className="text-sm text-blue-600 mt-1">The user needs to pay ₹{10 * session.ratePerMinute} to start the chat</p>
                  <p className="text-xs text-gray-400 mt-2">This page will update automatically when they pay</p>
                </div>
              )}

              {/* STATUS: ACTIVE — chat interface */}
              {session.status === 'active' && (
                <>
                  {/* Timer display (for pandit — shows elapsed, not countdown) */}
                  <div className={`rounded-2xl px-4 py-3 flex items-center gap-3 ${isExpiring ? 'bg-red-50 border-2 border-red-300' : 'bg-green-50 border border-green-200'}`}>
                    <span className="text-3xl">⏱️</span>
                    <div className="flex-1">
                      <p className="text-xs text-gray-500">Session elapsed</p>
                      <p className={`text-2xl font-bold font-mono ${isExpiring ? 'text-red-600 animate-pulse' : 'text-green-700'}`}>
                        {formatElapsed(elapsed * 1000)}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-gray-400">User paid</p>
                      <p className="text-lg font-bold text-violet-600">₹{session.totalPaidAmount}</p>
                      <p className="text-xs text-gray-400">{session.totalPaidMinutes} min total</p>
                    </div>
                  </div>
                  {isExpiring && (
                    <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-2 text-sm text-orange-700 font-semibold text-center">
                      ⚠️ User's time is almost up — they will be asked to recharge
                    </div>
                  )}

                  {/* Messages */}
                  <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                    <div className="h-64 overflow-y-auto p-3 space-y-2 bg-gradient-to-b from-violet-50/50 to-white">
                      {messages.length === 0 && (
                        <div className="text-center py-8">
                          <p className="text-2xl mb-1">🙏</p>
                          <p className="text-gray-400 text-sm">Waiting for first message…</p>
                        </div>
                      )}
                      {messages.map((m, i) => {
                        const isMe = m.senderRole === 'pandit';
                        return (
                          <div key={m._id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            {!isMe && <span className="text-lg mr-1 self-end">👤</span>}
                            <div className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm shadow-sm ${
                              isMe ? 'bg-violet-600 text-white rounded-br-sm' : 'bg-white text-gray-800 border border-gray-100 rounded-bl-sm'
                            }`}>
                              {m.messageType === 'image' ? (
                                <>
                                  <img
                                    src={mediaUrl(m.imageUrl)}
                                    alt="shared"
                                    className="rounded-xl max-w-full max-h-48 object-contain cursor-pointer"
                                    onClick={() => window.open(mediaUrl(m.imageUrl), '_blank')}
                                  />
                                  {m.text && <p className="mt-1 text-xs">{m.text}</p>}
                                </>
                              ) : (
                                <p>{m.text}</p>
                              )}
                              <p className={`text-xs mt-1 ${isMe ? 'text-violet-200' : 'text-gray-400'}`}>
                                {new Date(m.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                            {isMe && <span className="text-base ml-1 self-end">🧘</span>}
                          </div>
                        );
                      })}
                      <div ref={messagesEnd} />
                    </div>

                    {/* Image preview strip */}
                    {imgPreview && (
                      <div className="border-t border-gray-100 px-3 pt-2 flex items-center gap-2">
                        <img src={imgPreview} alt="preview" className="h-16 w-16 object-cover rounded-xl border border-violet-200 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-700 truncate">{imgFile?.name}</p>
                          <p className="text-xs text-gray-400">{imgFile ? (imgFile.size / 1024).toFixed(0) + ' KB' : ''}</p>
                        </div>
                        <button onClick={clearImage} className="text-red-500 hover:text-red-700 text-lg flex-shrink-0">✕</button>
                      </div>
                    )}

                    {/* Hidden file input */}
                    <input
                      ref={imgInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleImageSelect}
                    />

                    <form
                      onSubmit={imgPreview ? (e) => { e.preventDefault(); handleSendImage(); } : handleSend}
                      className="border-t border-gray-100 p-3 flex gap-2 items-center"
                    >
                      <button
                        type="button"
                        onClick={() => imgInputRef.current?.click()}
                        className="text-violet-500 hover:text-violet-700 text-xl flex-shrink-0 transition-colors"
                        title="Attach image"
                      >
                        🖼️
                      </button>
                      <input
                        type="text"
                        value={newMsg}
                        onChange={(e) => setNewMsg(e.target.value)}
                        placeholder={imgPreview ? 'Add a caption (optional)…' : 'Type your answer…'}
                        className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                      />
                      {imgPreview ? (
                        <button
                          type="submit"
                          disabled={sendingImg}
                          className="bg-violet-600 hover:bg-violet-700 disabled:bg-gray-200 text-white px-3 py-2 rounded-xl font-bold text-sm transition-colors flex-shrink-0"
                        >
                          {sendingImg ? '⏳' : '📤'}
                        </button>
                      ) : (
                        <button
                          type="submit"
                          disabled={sending || !newMsg.trim()}
                          className="bg-violet-600 hover:bg-violet-700 disabled:bg-gray-200 text-white px-4 py-2 rounded-xl font-bold text-sm transition-colors"
                        >
                          {sending ? '⏳' : '➤'}
                        </button>
                      )}
                    </form>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => navigate('/pandit/dashboard')}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-1.5"
                    >
                      🚪 Leave &amp; Rejoin Later
                    </button>
                    <button
                      onClick={handleEnd}
                      disabled={ending}
                      className="bg-red-100 hover:bg-red-200 text-red-700 font-semibold py-3 rounded-xl text-sm transition-colors"
                    >
                      {ending ? '⏳ Ending…' : '⏹ End Session'}
                    </button>
                  </div>
                </>
              )}

              {/* STATUS: EXPIRED — waiting for recharge */}
              {session.status === 'expired' && (
                <>
                  {messages.length > 0 && (
                    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                      <div className="h-40 overflow-y-auto p-3 space-y-2 opacity-50">
                        {messages.map((m, i) => {
                          const isMe = m.senderRole === 'pandit';
                          return (
                            <div key={m._id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm ${isMe ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
                                {m.messageType === 'image'
                                  ? <img src={mediaUrl(m.imageUrl)} alt="shared" className="rounded-lg max-h-20 object-contain" />
                                  : m.text}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 text-center">
                    <p className="text-3xl mb-2">⏰</p>
                    <p className="font-bold text-orange-800 text-base">User's 10 Minutes Are Up</p>
                    <p className="text-sm text-orange-600 mt-1">Waiting for user to recharge for 10 more minutes…</p>
                    <p className="text-xs text-gray-400 mt-2">Page will update automatically if they recharge</p>
                    <div className="mt-3 bg-white rounded-xl p-3 border border-orange-100">
                      <p className="text-sm text-gray-600">Total earned so far: <span className="font-bold text-violet-600">₹{session.totalPaidAmount}</span></p>
                    </div>
                    <button
                      onClick={handleEnd}
                      disabled={ending}
                      className="mt-3 text-sm text-gray-500 font-semibold border border-gray-200 px-5 py-2 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      {ending ? '⏳' : 'End Session (if user doesn\'t recharge)'}
                    </button>
                  </div>
                </>
              )}

              {/* STATUS: ENDED */}
              {session.status === 'ended' && (
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 text-center">
                  <p className="text-3xl mb-2">✅</p>
                  <p className="font-bold text-gray-800">Session Ended</p>
                  <div className="grid grid-cols-2 gap-3 my-3">
                    <div className="bg-white rounded-xl p-3 border border-gray-100">
                      <p className="font-bold text-violet-600">{session.totalPaidMinutes} min</p>
                      <p className="text-xs text-gray-400">Total time</p>
                    </div>
                    <div className="bg-white rounded-xl p-3 border border-gray-100">
                      <p className="font-bold text-green-600">₹{session.totalPaidAmount}</p>
                      <p className="text-xs text-gray-400">Total earned</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setSession(null); setMessages([]); }}
                    className="text-violet-600 font-semibold text-sm hover:underline"
                  >
                    Clear &amp; wait for next request
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════
          TAB: HISTORY
      ══════════════════════════════════════ */}
      {tab === 'history' && (
        <div className="space-y-3">
          {histLoading ? (
            <div className="flex justify-center py-10"><LoadingSpinner /></div>
          ) : history.length === 0 ? (
            <div className="bg-gray-50 border border-gray-100 rounded-2xl text-center py-10">
              <p className="text-4xl mb-2">📜</p>
              <p className="text-gray-500">No past sessions yet</p>
            </div>
          ) : (
            history.map((s) => (
              <div key={s._id} className="bg-white border border-gray-100 rounded-2xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-xl flex-shrink-0">👤</div>
                  <div className="flex-1">
                    <p className="font-bold text-gray-900 text-sm">{s.userId?.name}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(s.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <span className="text-xs font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{s.status}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-gray-50 rounded-xl py-2">
                    <p className="text-sm font-bold text-violet-600">{s.totalPaidMinutes} min</p>
                    <p className="text-xs text-gray-400">Duration</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl py-2">
                    <p className="text-sm font-bold text-gray-700">₹{s.ratePerMinute}/m</p>
                    <p className="text-xs text-gray-400">Rate</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl py-2">
                    <p className="text-sm font-bold text-green-600">₹{s.totalPaidAmount}</p>
                    <p className="text-xs text-gray-400">Earned</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
