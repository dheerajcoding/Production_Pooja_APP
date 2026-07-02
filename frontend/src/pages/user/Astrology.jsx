import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { mediaUrl } from '../../utils/media';

const POLL_INTERVAL  = 3000;  // poll every 3 s during active/waiting session
const BLOCK_MINUTES  = 10;

/* ── helpers ── */
function padTwo(n) { return String(n).padStart(2, '0'); }
function formatCountdown(ms) {
  if (ms <= 0) return '00:00';
  const totalSec = Math.ceil(ms / 1000);
  return `${padTwo(Math.floor(totalSec / 60))}:${padTwo(totalSec % 60)}`;
}

function StarRow({ value = 0 }) {
  const v = Math.round(Number(value));
  return (
    <span className="text-amber-400 text-xs">
      {'★'.repeat(v)}{'☆'.repeat(5 - v)}
      <span className="text-gray-400 ml-1">({Number(value).toFixed(1)})</span>
    </span>
  );
}

/* ── Razorpay helper ── */
function loadRazorpay() {
  return new Promise((res) => {
    if (window.Razorpay) return res(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => res(true);
    s.onerror = () => res(false);
    document.body.appendChild(s);
  });
}

export default function UserAstrology() {
  const { user } = useAuth();

  /* browse */
  const [astrologers, setAstrologers]     = useState([]);
  const [astroLoading, setAstroLoading]   = useState(true);

  /* session */
  const [session, setSession]             = useState(null);
  const [sessionLoading, setSessLoading]  = useState(true);
  const [messages, setMessages]           = useState([]);
  const [newMsg, setNewMsg]               = useState('');
  const [sending, setSending]             = useState(false);
  const [imgFile, setImgFile]             = useState(null);
  const [imgPreview, setImgPreview]       = useState('');
  const [sendingImg, setSendingImg]       = useState(false);
  const imgInputRef                       = useRef(null);
  const [requesting, setRequesting]       = useState(null);
  const [ending, setEnding]               = useState(false);
  const [paying, setPaying]               = useState(false);
  const [rejoinedSession, setRejoinedSession] = useState(false);

  /* countdown */
  const [countdown, setCountdown]         = useState(0); // ms remaining
  const countdownRef                      = useRef(null);

  /* polling */
  const pollRef       = useRef(null);
  const lastMsgTime   = useRef(null);
  const messagesEnd   = useRef(null);

  /* tab */
  const [tab, setTab]                     = useState('browse');

  /* history */
  const [history, setHistory]             = useState([]);
  const [histLoading, setHistLoading]     = useState(false);

  /* ── load astrologers + check open session ── */
  useEffect(() => {
    api.get('/astro/pandits')
      .then(({ data }) => setAstrologers(data.data))
      .catch(() => {})
      .finally(() => setAstroLoading(false));

    api.get('/astro/session/active')
      .then(({ data }) => {
        if (data.data) {
          applySession(data.data);
          setTab('chat');
          // Show "Welcome Back" banner only if session was already in progress
          if (['active', 'expired', 'accepted'].includes(data.data.status)) {
            setRejoinedSession(true);
            setTimeout(() => setRejoinedSession(false), 6000);
          }
        }
      })
      .catch(() => {})
      .finally(() => setSessLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── scroll to latest message ── */
  useEffect(() => { messagesEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  /* ── countdown tick ── */
  useEffect(() => {
    clearInterval(countdownRef.current);
    if (session?.status === 'active' && session?.paidUntil) {
      const tick = () => {
        const ms = new Date(session.paidUntil).getTime() - Date.now();
        setCountdown(Math.max(0, ms));
      };
      tick();
      countdownRef.current = setInterval(tick, 500);
    }
    return () => clearInterval(countdownRef.current);
  }, [session?.status, session?.paidUntil]);

  /* ── apply session helper ── */
  const applySession = (s) => {
    setSession(s);
    setMessages(s.messages || []);
    lastMsgTime.current = s.messages?.slice(-1)[0]?.createdAt || null;
  };

  /* ── polling ── */
  const pollMessages = useCallback(async () => {
    if (!session?._id) return;
    try {
      const since = lastMsgTime.current ? `?since=${encodeURIComponent(lastMsgTime.current)}` : '';
      const { data } = await api.get(`/astro/session/${session._id}/messages${since}`);
      const { messages: newMsgs, status, paidUntil, justExpired } = data.data;

      if (newMsgs?.length) {
        setMessages((prev) => [...prev, ...newMsgs]);
        lastMsgTime.current = newMsgs.slice(-1)[0].createdAt;
      }

      /* status changed externally */
      if (status !== session.status) {
        setSession((prev) => ({ ...prev, status, paidUntil: paidUntil || prev?.paidUntil }));
        if (status === 'active')  toast.success('🟢 Chat is now live! Timer started.');
        if (status === 'expired' || justExpired) {
          clearInterval(pollRef.current);
          toast('⏰ Time\'s up! Recharge to continue.', { icon: '⏰' });
          setSession((prev) => ({ ...prev, status: 'expired' }));
        }
        if (status === 'ended') {
          clearInterval(pollRef.current);
          clearInterval(countdownRef.current);
        }
      }
    } catch { /* network hiccup, ignore */ }
  }, [session?._id, session?.status]);

  useEffect(() => {
    clearInterval(pollRef.current);
    if (session && ['waiting', 'accepted', 'active', 'expired'].includes(session.status)) {
      pollRef.current = setInterval(pollMessages, POLL_INTERVAL);
    }
    return () => clearInterval(pollRef.current);
  }, [session?._id, session?.status, pollMessages]);

  /* ── request chat ── */
  const handleRequest = async (panditId) => {
    setRequesting(panditId);
    try {
      const { data } = await api.post('/astro/session/request', { panditId });
      applySession(data.data);
      setTab('chat');
      toast.success('Request sent! Waiting for pandit to accept…');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not send request.');
    } finally {
      setRequesting(null);
    }
  };

  /* ── pay for a 10-min block (initial OR recharge) ── */
  const handlePay = async () => {
    if (!session) return;
    setPaying(true);
    try {
      const ok = await loadRazorpay();
      if (!ok) { toast.error('Payment gateway failed to load.'); return; }

      const { data } = await api.post(`/astro/session/${session._id}/pay/create`);
      const { orderId, amount, currency, blockAmount, keyId } = data.data;
      const panditName = session.panditId?.userId?.name || 'Pandit';

      const rzp = new window.Razorpay({
        key:      keyId,
        amount, currency,
        order_id: orderId,
        name:     'Saral Pooja — Astrology Chat',
        description: `10 minutes with ${panditName}`,
        handler: async (response) => {
          try {
            const { data: vData } = await api.post(`/astro/session/${session._id}/pay/verify`, {
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
            });
            applySession(vData.data);
            toast.success(`✅ Paid ₹${blockAmount}! Chat is live for 10 minutes.`);
          } catch {
            toast.error('Payment verification failed. Please contact support.');
          } finally {
            setPaying(false);
          }
        },
        modal: { ondismiss: () => setPaying(false) },
        prefill: { name: user?.name, email: user?.email },
        theme:   { color: '#7c3aed' },
      });
      rzp.open();
    } catch (err) {
      const msg = err.response?.data?.message || 'Could not initiate payment. Please try again.';
      toast.error(msg);
      // If session status is stale, refresh it
      if (session?._id) {
        api.get(`/astro/session/${session._id}`).then(({ data }) => {
          if (data.data) setSession((prev) => ({ ...prev, ...data.data }));
        }).catch(() => {});
      }
      setPaying(false);
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
      const msg = err.response?.data?.message || 'Could not send.';
      toast.error(msg);
      if (msg.includes('10 minutes')) setSession((prev) => ({ ...prev, status: 'expired' }));
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
      const msg = err.response?.data?.message || 'Could not send image.';
      toast.error(msg);
      if (msg.includes('10 minutes')) setSession((prev) => ({ ...prev, status: 'expired' }));
    } finally {
      setSendingImg(false);
    }
  };

  /* ── cancel image selection ── */
  const clearImage = () => {
    setImgFile(null);
    if (imgPreview) URL.revokeObjectURL(imgPreview);
    setImgPreview('');
  };

  /* ── end session ── */
  const handleEnd = async () => {
    if (!session) return;
    // Warn user if they still have paid time remaining
    const remaining = session.paidUntil ? Math.max(0, new Date(session.paidUntil).getTime() - Date.now()) : 0;
    const confirmMsg = remaining > 30000
      ? `⚠️ You still have ${formatCountdown(remaining)} of paid time left!\n\nIf you end now, you will lose this time — it will NOT be refunded.\n\nClick OK to end permanently, or Cancel to go back.`
      : 'End this chat session?';
    if (!window.confirm(confirmMsg)) return;
    setEnding(true);
    try {
      await api.put(`/astro/session/${session._id}/end`);
      setSession((prev) => ({ ...prev, status: 'ended' }));
      clearInterval(pollRef.current);
      clearInterval(countdownRef.current);
      toast.success('Session ended.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not end session.');
    } finally {
      setEnding(false);
    }
  };

  /* ── cancel waiting request ── */
  const handleCancel = async () => {
    if (!session) return;
    try {
      await api.put(`/astro/session/${session._id}/cancel`);
      setSession(null);
      setMessages([]);
      setTab('browse');
      toast.success('Request cancelled.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not cancel.');
    }
  };

  /* ── load history ── */
  const loadHistory = async () => {
    setTab('history');
    setHistLoading(true);
    try {
      const { data } = await api.get('/astro/sessions/my');
      setHistory(data.data);
    } catch { /* ignore */ } finally {
      setHistLoading(false);
    }
  };

  /* ── derived ── */
  const blockCost = session ? BLOCK_MINUTES * (session.ratePerMinute || 0) : 0;
  const isExpiring = session?.status === 'active' && countdown > 0 && countdown < 60000; // last 60 s

  /* ════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-4 pb-8">

      {/* ── HEADER ── */}
      <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 rounded-3xl p-5 text-white">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-5xl">🔮</span>
          <div>
            <h1 className="text-xl font-bold">Live Astrology Chat</h1>
            <p className="text-purple-200 text-sm">Talk to an expert astrologer • ₹X per 10 minutes</p>
          </div>
        </div>

        {/* how it works strip */}
        <div className="grid grid-cols-4 gap-1 text-center mb-3">
          {[
            { i: '🧘', l: 'Choose' },
            { i: '✅', l: 'Pandit Accepts' },
            { i: '💳', l: 'Pay 10 min' },
            { i: '💬', l: 'Chat Live' },
          ].map((s, idx) => (
            <div key={idx} className="bg-white/10 rounded-xl py-2 px-1">
              <p className="text-xl">{s.i}</p>
              <p className="text-xs text-purple-100 font-semibold leading-tight mt-0.5">{s.l}</p>
            </div>
          ))}
        </div>

        {/* tabs */}
        <div className="flex gap-1">
          {[
            { key: 'browse',  label: '🧘 Browse' },
            { key: 'chat',    label: `💬 My Chat${session && ['waiting','accepted','active','expired'].includes(session.status) ? ' 🔴' : ''}` },
            { key: 'history', label: '📜 History' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => key === 'history' ? loadHistory() : setTab(key)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${tab === key ? 'bg-white text-violet-700' : 'bg-white/20 text-white hover:bg-white/30'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════
          TAB: BROWSE
      ══════════════════════════════════════ */}
      {tab === 'browse' && (
        <div className="space-y-3">
          {/* Active session reminder strip */}
          {session && ['active', 'expired', 'accepted', 'waiting'].includes(session.status) && (
            <button
              onClick={() => setTab('chat')}
              className="w-full bg-violet-600 text-white rounded-2xl px-4 py-3 flex items-center gap-3 hover:bg-violet-700 transition-colors active:scale-95"
            >
              <span className="text-2xl">
                {session.status === 'active' ? '💬' : session.status === 'expired' ? '⏰' : '⏳'}
              </span>
              <div className="flex-1 text-left">
                <p className="font-bold text-sm">
                  {session.status === 'active'
                    ? `Active Chat — ${formatCountdown(countdown)} remaining`
                    : session.status === 'expired'
                    ? 'Session paused — tap to recharge'
                    : 'Session in progress — tap to view'}
                </p>
                <p className="text-xs text-violet-200">Tap to rejoin your chat</p>
              </div>
              <span className="text-white text-lg">→</span>
            </button>
          )}

          {astroLoading ? (
            <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
          ) : astrologers.length === 0 ? (
            <div className="bg-gray-50 border border-gray-100 rounded-2xl text-center py-12">
              <p className="text-4xl mb-2">😔</p>
              <p className="text-gray-500 font-semibold">No astrologers added yet</p>
              <p className="text-xs text-gray-400 mt-1">Admin will add astrologers soon</p>
            </div>
          ) : (
            astrologers.map((p) => (
              <div key={p._id} className={`bg-white rounded-2xl border-2 overflow-hidden transition-shadow hover:shadow-md ${p.isLiveNow ? 'border-green-200' : 'border-gray-100'}`}>
                {/* status strip */}
                <div className={`px-4 py-2 flex items-center ${p.isLiveNow ? 'bg-green-500' : 'bg-gray-200'}`}>
                  <span className={`text-sm font-bold ${p.isLiveNow ? 'text-white' : 'text-gray-500'}`}>
                    {p.isLiveNow ? '🟢 LIVE — Available Now' : '🔴 Offline'}
                  </span>
                  <span className={`ml-auto text-sm font-bold ${p.isLiveNow ? 'text-white' : 'text-gray-500'}`}>
                    ₹{p.astroRate}/min &nbsp;|&nbsp; ₹{BLOCK_MINUTES * p.astroRate} for 10 min
                  </span>
                </div>

                <div className="p-4 flex gap-3">
                  {/* photo */}
                  <div className="w-16 h-16 rounded-2xl bg-violet-100 flex items-center justify-center overflow-hidden flex-shrink-0 text-3xl">
                    {p.photo ? <img src={p.photo} alt="" className="w-full h-full object-cover" /> : '🧘'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-base">{p.name}</p>
                    <StarRow value={p.rating || 0} />
                    {p.expertise?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {p.expertise.slice(0, 4).map((e) => (
                          <span key={e} className="text-xs bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full">{e}</span>
                        ))}
                      </div>
                    )}
                    {p.languages?.length > 0 && (
                      <p className="text-xs text-gray-400 mt-1">🗣 {p.languages.join(', ')}</p>
                    )}
                    {p.bio && <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{p.bio}</p>}
                  </div>
                </div>

                <div className="px-4 pb-4">
                  {p.isLiveNow ? (
                    <button
                      onClick={() => handleRequest(p._id)}
                      disabled={!!session || requesting === p._id}
                      className="w-full bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl text-sm transition-colors active:scale-95"
                    >
                      {requesting === p._id
                        ? '⏳ Sending…'
                        : session
                        ? '❌ You have an open session'
                        : `💬 Chat Now — ₹${BLOCK_MINUTES * p.astroRate} for 10 min`}
                    </button>
                  ) : (
                    <div className="w-full bg-gray-100 text-gray-400 font-semibold py-3 rounded-xl text-center text-sm">
                      Offline — Not Available Right Now
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ══════════════════════════════════════
          TAB: CHAT
      ══════════════════════════════════════ */}
      {tab === 'chat' && (
        <div className="space-y-3">
          {sessionLoading ? (
            <div className="flex justify-center py-10"><LoadingSpinner /></div>
          ) : !session ? (
            <div className="bg-gray-50 border border-gray-100 rounded-2xl text-center py-12">
              <p className="text-4xl mb-2">💬</p>
              <p className="text-gray-500 font-semibold">No active session</p>
              <button onClick={() => setTab('browse')} className="mt-3 bg-violet-600 text-white px-6 py-2 rounded-xl font-semibold text-sm hover:bg-violet-700 transition-colors">
                Browse Astrologers →
              </button>
            </div>
          ) : (
            <>
              {/* ── Pandit info bar ── */}
              <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-violet-100 overflow-hidden flex items-center justify-center text-2xl flex-shrink-0">
                  {session.panditId?.photo
                    ? <img src={session.panditId.photo} alt="" className="w-full h-full object-cover" />
                    : '🧘'}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-900">{session.panditId?.userId?.name}</p>
                  <p className="text-xs text-gray-500">₹{session.ratePerMinute}/min • ₹{blockCost} per 10 min block</p>
                </div>
                {/* status badge */}
                <span className={`text-xs font-bold px-3 py-1.5 rounded-full flex-shrink-0 ${
                  session.status === 'waiting'  ? 'bg-amber-100 text-amber-700' :
                  session.status === 'accepted' ? 'bg-blue-100 text-blue-700' :
                  session.status === 'active'   ? 'bg-green-100 text-green-700' :
                  session.status === 'expired'  ? 'bg-red-100 text-red-600' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {session.status === 'waiting'  ? '⏳ Waiting' :
                   session.status === 'accepted' ? '✅ Accepted' :
                   session.status === 'active'   ? '🟢 Live' :
                   session.status === 'expired'  ? '⏰ Time Up' :
                   session.status === 'ended'    ? '⏹ Ended' :
                   session.status === 'rejected' ? '❌ Rejected' : session.status}
                </span>
              </div>

              {/* ── STATUS: WAITING ── */}
              {session.status === 'waiting' && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center">
                  <div className="text-4xl mb-2 animate-pulse">⏳</div>
                  <p className="font-bold text-amber-800 text-base">Waiting for Pandit to Accept</p>
                  <p className="text-sm text-amber-600 mt-1">You will be notified as soon as they accept</p>
                  <p className="text-xs text-amber-500 mt-1">You will NOT be charged until the pandit accepts and you pay</p>
                  <button
                    onClick={handleCancel}
                    className="mt-4 text-sm text-red-600 font-semibold border border-red-200 px-4 py-2 rounded-xl hover:bg-red-50 transition-colors"
                  >
                    Cancel Request
                  </button>
                </div>
              )}

              {/* ── STATUS: ACCEPTED → PAY ── */}
              {session.status === 'accepted' && (
                <div className="bg-blue-50 border-2 border-blue-300 rounded-2xl p-5">
                  <div className="text-center mb-4">
                    <p className="text-4xl mb-2">🎉</p>
                    <p className="text-lg font-bold text-blue-800">Pandit has Accepted!</p>
                    <p className="text-sm text-blue-600 mt-1">Pay now to start your 10-minute chat session</p>
                  </div>

                  {/* Bill breakdown */}
                  <div className="bg-white rounded-2xl p-4 mb-4 border border-blue-100">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Bill Summary</p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Rate per minute</span>
                        <span className="font-semibold">₹{session.ratePerMinute}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Session duration</span>
                        <span className="font-semibold">10 minutes</span>
                      </div>
                      <div className="border-t border-gray-100 pt-2 flex justify-between">
                        <span className="font-bold text-gray-900">Total to Pay</span>
                        <span className="font-bold text-blue-700 text-lg">₹{blockCost}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handlePay}
                    disabled={paying}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-bold py-4 rounded-xl text-base transition-colors active:scale-95"
                  >
                    {paying ? '⏳ Opening Payment…' : `💳 Pay ₹${blockCost} & Start Chat`}
                  </button>
                  <p className="text-xs text-center text-gray-400 mt-2">Secure payment via Razorpay</p>
                </div>
              )}

              {/* ── WELCOME BACK BANNER (shown when rejoining) ── */}
              {rejoinedSession && (
                <div className="bg-green-500 text-white rounded-2xl px-4 py-3 flex items-center gap-3">
                  <span className="text-2xl">🔄</span>
                  <div className="flex-1">
                    <p className="font-bold text-sm">Welcome Back!</p>
                    <p className="text-xs text-green-100">
                      {session.status === 'active'
                        ? `Your session is still live — ${formatCountdown(countdown)} remaining`
                        : session.status === 'expired'
                        ? 'Your session is paused — recharge to continue'
                        : 'Your session is still open'}
                    </p>
                  </div>
                  <button
                    onClick={() => setRejoinedSession(false)}
                    className="text-green-200 hover:text-white text-lg flex-shrink-0"
                  >✕</button>
                </div>
              )}

              {/* ── STATUS: ACTIVE → CHAT ── */}
              {session.status === 'active' && (
                <>
                  {/* Countdown timer */}
                  <div className={`rounded-2xl px-4 py-3 flex items-center gap-3 ${isExpiring ? 'bg-red-50 border-2 border-red-300 animate-pulse' : 'bg-green-50 border border-green-200'}`}>
                    <span className="text-3xl">{isExpiring ? '⚠️' : '⏱️'}</span>
                    <div className="flex-1">
                      <p className={`text-xs font-semibold ${isExpiring ? 'text-red-600' : 'text-green-600'}`}>
                        {isExpiring ? 'Less than 1 minute left!' : 'Time Remaining'}
                      </p>
                      <p className={`text-3xl font-bold font-mono ${isExpiring ? 'text-red-600' : 'text-green-700'}`}>
                        {formatCountdown(countdown)}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-gray-400">Paid so far</p>
                      <p className="text-base font-bold text-violet-600">₹{session.totalPaidAmount}</p>
                      <p className="text-xs text-gray-400">{session.totalPaidMinutes} min total</p>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                    <div className="h-64 overflow-y-auto p-3 space-y-2 bg-gradient-to-b from-violet-50/50 to-white">
                      {messages.length === 0 && (
                        <div className="text-center py-8">
                          <p className="text-2xl mb-1">🙏</p>
                          <p className="text-gray-400 text-sm">Chat started — say Namaste!</p>
                        </div>
                      )}
                      {messages.map((m, i) => {
                        const isMe = m.senderRole === 'user';
                        return (
                          <div key={m._id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            {!isMe && <span className="text-lg mr-1 self-end">🧘</span>}
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
                            {isMe && <span className="text-base ml-1 self-end">😊</span>}
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
                        <button onClick={clearImage} className="text-red-500 hover:text-red-700 text-lg flex-shrink-0" title="Remove">✕</button>
                      </div>
                    )}

                    {/* Input row */}
                    <form onSubmit={imgPreview ? (e) => { e.preventDefault(); handleSendImage(); } : handleSend}
                      className="border-t border-gray-100 p-3 flex gap-2 items-center">
                      {/* Hidden file input */}
                      <input
                        ref={imgInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={handleImageSelect}
                      />
                      {/* Image attach button */}
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
                        placeholder={imgPreview ? 'Add a caption (optional)…' : 'Type your question…'}
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
                      onClick={() => setTab('browse')}
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

              {/* ── STATUS: EXPIRED → RECHARGE ── */}
              {session.status === 'expired' && (
                <>
                  {/* Show past messages read-only */}
                  {messages.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                      <div className="h-48 overflow-y-auto p-3 space-y-2 opacity-60">
                        {messages.map((m, i) => {
                          const isMe = m.senderRole === 'user';
                          return (
                            <div key={m._id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm ${isMe ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
                                {m.messageType === 'image'
                                  ? <img src={mediaUrl(m.imageUrl)} alt="shared" className="rounded-lg max-h-24 object-contain" />
                                  : m.text}
                              </div>
                            </div>
                          );
                        })}
                        <div ref={messagesEnd} />
                      </div>
                    </div>
                  )}

                  {/* Recharge card */}
                  <div className="bg-orange-50 border-2 border-orange-300 rounded-2xl p-5">
                    <div className="text-center mb-4">
                      <p className="text-4xl mb-2">⏰</p>
                      <p className="text-xl font-bold text-orange-800">10 Minutes Are Up!</p>
                      <p className="text-sm text-orange-600 mt-1">Recharge to continue talking to the pandit</p>
                    </div>

                    <div className="bg-white rounded-2xl p-4 mb-4 border border-orange-100">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="font-bold text-violet-600 text-lg">{session.totalPaidMinutes} min</p>
                          <p className="text-xs text-gray-400">Used so far</p>
                        </div>
                        <div>
                          <p className="font-bold text-gray-700 text-lg">₹{session.ratePerMinute}/m</p>
                          <p className="text-xs text-gray-400">Rate</p>
                        </div>
                        <div>
                          <p className="font-bold text-orange-600 text-lg">₹{session.totalPaidAmount}</p>
                          <p className="text-xs text-gray-400">Paid total</p>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handlePay}
                      disabled={paying}
                      className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-bold py-4 rounded-xl text-base transition-colors active:scale-95"
                    >
                      {paying ? '⏳ Opening Payment…' : `🔄 Recharge — ₹${blockCost} for 10 More Minutes`}
                    </button>

                    <button
                      onClick={handleEnd}
                      disabled={ending}
                      className="w-full mt-2 text-sm text-gray-500 font-semibold py-2 rounded-xl hover:bg-gray-100 transition-colors"
                    >
                      {ending ? '⏳' : 'No thanks, end session'}
                    </button>
                  </div>
                </>
              )}

              {/* ── STATUS: ENDED ── */}
              {session.status === 'ended' && (
                <>
                  {messages.length > 0 && (
                    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                      <p className="text-xs text-gray-400 px-4 pt-3 pb-1 font-semibold">Chat History</p>
                      <div className="h-52 overflow-y-auto p-3 space-y-2">
                        {messages.map((m, i) => {
                          const isMe = m.senderRole === 'user';
                          return (
                            <div key={m._id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm ${isMe ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
                                {m.messageType === 'image'
                                  ? <img src={mediaUrl(m.imageUrl)} alt="shared" className="rounded-lg max-h-28 object-contain cursor-pointer" onClick={() => window.open(mediaUrl(m.imageUrl), '_blank')} />
                                  : m.text}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 text-center">
                    <p className="text-3xl mb-2">✅</p>
                    <p className="font-bold text-gray-800 text-base">Session Ended</p>
                    <div className="grid grid-cols-2 gap-3 my-3">
                      <div className="bg-white rounded-xl p-3 border border-gray-100">
                        <p className="font-bold text-violet-600">{session.totalPaidMinutes} min</p>
                        <p className="text-xs text-gray-400">Total time</p>
                      </div>
                      <div className="bg-white rounded-xl p-3 border border-gray-100">
                        <p className="font-bold text-orange-600">₹{session.totalPaidAmount}</p>
                        <p className="text-xs text-gray-400">Total paid</p>
                      </div>
                    </div>
                    <button
                      onClick={() => { setSession(null); setMessages([]); setTab('browse'); }}
                      className="bg-violet-600 hover:bg-violet-700 text-white font-semibold px-6 py-2 rounded-xl text-sm transition-colors"
                    >
                      Browse More Astrologers →
                    </button>
                  </div>
                </>
              )}

              {/* ── STATUS: REJECTED ── */}
              {session.status === 'rejected' && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
                  <p className="text-3xl mb-2">😔</p>
                  <p className="font-bold text-red-700">Request Not Accepted</p>
                  <p className="text-sm text-gray-500 mt-1">The pandit could not take your request right now.</p>
                  {session.rejectionNote && (
                    <p className="text-sm text-gray-600 mt-2 bg-white rounded-xl px-3 py-2 border border-red-100">{session.rejectionNote}</p>
                  )}
                  <button
                    onClick={() => { setSession(null); setMessages([]); setTab('browse'); }}
                    className="mt-4 bg-violet-600 text-white font-semibold px-6 py-2 rounded-xl text-sm hover:bg-violet-700 transition-colors"
                  >
                    Try Another Pandit →
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
              <p className="text-gray-500 font-semibold">No past sessions</p>
            </div>
          ) : (
            history.map((s) => (
              <div key={s._id} className="bg-white border border-gray-100 rounded-2xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-100 overflow-hidden flex items-center justify-center text-xl flex-shrink-0">
                    {s.panditId?.photo ? <img src={s.panditId.photo} alt="" className="w-full h-full object-cover" /> : '🧘'}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-gray-900 text-sm">{s.panditId?.userId?.name}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(s.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${s.status === 'ended' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {s.status}
                  </span>
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
                    <p className="text-sm font-bold text-orange-600">₹{s.totalPaidAmount}</p>
                    <p className="text-xs text-gray-400">Paid</p>
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
