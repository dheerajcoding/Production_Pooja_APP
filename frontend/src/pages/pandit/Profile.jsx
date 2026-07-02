import { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const EXPERTISE_OPTIONS = ['Griha Pravesh', 'Satyanarayan Katha', 'Navratri', 'Ganesh Puja', 'Laxmi Puja', 'Shradh', 'Vivah', 'Namkaran', 'Mundan', 'Other'];
const LANGUAGE_OPTIONS = ['Hindi', 'Sanskrit', 'Marathi', 'Gujarati', 'Bengali', 'Tamil', 'Telugu', 'Kannada', 'Punjabi', 'English'];

export default function PanditProfile() {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', bio: '', experience: '', location: '', languages: [], expertise: [] });

  useEffect(() => {
    api.get('/pandits/profile').then(({ data }) => {
      const p = data.data;
      setProfile(p);
      setPreview(p.photo || p.userId?.profilePhoto || '');
      setForm({
        name: p.userId?.name || '',
        phone: p.userId?.phone || '',
        bio: p.bio || '',
        experience: p.experience || '',
        location: p.location || '',
        languages: p.languages || [],
        expertise: p.expertise || [],
      });
    }).finally(() => setLoading(false));
  }, []);

  const toggleItem = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].includes(value) ? prev[field].filter((v) => v !== value) : [...prev[field], value],
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (Array.isArray(v)) v.forEach((item) => fd.append(`${k}[]`, item));
        else fd.append(k, v);
      });
      if (photo) fd.append('photo', photo);

      const { data } = await api.put('/pandits/profile', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setProfile(data.data);
      updateUser({ name: form.name, phone: form.phone });
      toast.success('Profile updated.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <span className={`badge ${profile?.isApproved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
          {profile?.isApproved ? '✓ Approved' : '⏳ Pending Approval'}
        </span>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        <div className="card">
          <h3 className="font-semibold mb-4">Photo & Basic Info</h3>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center overflow-hidden">
              {preview ? <img src={preview} alt="" className="w-full h-full object-cover" /> : <span className="text-3xl font-bold text-amber-600">{user?.name?.charAt(0)}</span>}
            </div>
            <label className="btn-secondary text-sm cursor-pointer">
              Change Photo
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files[0]; if (f) { setPhoto(f); setPreview(URL.createObjectURL(f)); } }} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Full Name</label>
              <input type="text" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="label">Phone</label>
              <input type="tel" className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="label">Experience (years)</label>
              <input type="number" className="input" min="0" value={form.experience} onChange={(e) => setForm({ ...form, experience: e.target.value })} />
            </div>
            <div>
              <label className="label">Location / City</label>
              <input type="text" className="input" placeholder="Mumbai, Maharashtra" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
          </div>
          <div className="mt-4">
            <label className="label">Bio</label>
            <textarea className="input resize-none" rows={3} placeholder="Brief description about yourself and your experience..." value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} maxLength={1000} />
          </div>
        </div>

        <div className="card">
          <h3 className="font-semibold mb-3">Languages</h3>
          <div className="flex flex-wrap gap-2">
            {LANGUAGE_OPTIONS.map((lang) => (
              <button key={lang} type="button" onClick={() => toggleItem('languages', lang)} className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${form.languages.includes(lang) ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'}`}>
                {lang}
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 className="font-semibold mb-3">Expertise (Pooja Types)</h3>
          <div className="flex flex-wrap gap-2">
            {EXPERTISE_OPTIONS.map((exp) => (
              <button key={exp} type="button" onClick={() => toggleItem('expertise', exp)} className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${form.expertise.includes(exp) ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-gray-200 hover:border-amber-300'}`}>
                {exp}
              </button>
            ))}
          </div>
        </div>

        <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Profile'}</button>
      </form>
    </div>
  );
}
