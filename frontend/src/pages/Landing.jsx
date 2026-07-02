import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const POOJAS = [
  { name: 'Griha Pravesh', icon: '🏠', desc: 'Blessings for your new home' },
  { name: 'Satyanarayan Katha', icon: '📖', desc: 'Divine storytelling ceremony' },
  { name: 'Ganesh Puja', icon: '🐘', desc: 'Remove obstacles, invite success' },
  { name: 'Laxmi Puja', icon: '💫', desc: 'Invite prosperity and wealth' },
  { name: 'Vivah Puja', icon: '💍', desc: 'Sacred wedding ceremonies' },
  { name: 'Namkaran', icon: '👶', desc: 'Naming ceremony for newborn' },
];

const STEPS = [
  { step: '1', title: 'Browse Poojas', desc: 'Explore our wide range of religious ceremonies' },
  { step: '2', title: 'Select Date & Time', desc: 'Choose a convenient schedule for your pooja' },
  { step: '3', title: 'Book & Pay', desc: 'Secure booking with instant payment' },
  { step: '4', title: 'Pandit at Doorstep', desc: 'Experienced pandit arrives at your home' },
];

export default function Landing() {
  const { user } = useAuth();

  const dashboardLink = user?.role === 'admin' ? '/admin' : user?.role === 'pandit' ? '/pandit' : user ? '/dashboard' : null;

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-100 px-4 sm:px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🪔</span>
            <span className="text-xl font-bold text-primary-600">Saral Pooja</span>
          </div>
          <div className="flex items-center gap-3">
            {dashboardLink ? (
              <Link to={dashboardLink} className="btn-primary text-sm">Go to Dashboard</Link>
            ) : (
              <>
                <Link to="/login" className="btn-secondary text-sm">Login</Link>
                <Link to="/register" className="btn-primary text-sm">Register</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
            <span>✨</span> Trusted by hundreds of families
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Book Pandits for<br />
            <span className="text-primary-500">Sacred Ceremonies</span>
          </h1>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            Connect with experienced, verified pandits for all your religious ceremonies.
            Simple booking, transparent pricing, and authentic rituals.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/register" className="btn-primary text-base px-8 py-3">Book a Pooja</Link>
            <Link to="/login" className="btn-secondary text-base px-8 py-3">Pandit Login</Link>
          </div>
        </div>
      </section>

      {/* Poojas */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900">Popular Ceremonies</h2>
            <p className="text-gray-500 mt-2">We cover all major Hindu religious ceremonies</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {POOJAS.map((p) => (
              <div key={p.name} className="card text-center hover:shadow-md transition-shadow cursor-pointer p-4">
                <div className="text-3xl mb-2">{p.icon}</div>
                <h3 className="font-semibold text-sm text-gray-900">{p.name}</h3>
                <p className="text-xs text-gray-500 mt-1">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900">How It Works</h2>
            <p className="text-gray-500 mt-2">Simple 4-step process to book your pooja</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((s) => (
              <div key={s.step} className="text-center">
                <div className="w-14 h-14 rounded-full bg-primary-500 text-white flex items-center justify-center text-xl font-bold mx-auto mb-4">
                  {s.step}
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{s.title}</h3>
                <p className="text-sm text-gray-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 bg-primary-500">
        <div className="max-w-3xl mx-auto text-center text-white">
          <h2 className="text-3xl font-bold mb-4">Ready to Book Your Pooja?</h2>
          <p className="text-primary-100 mb-8">Join thousands of families who trust Saral Pooja for their spiritual needs.</p>
          <Link to="/register" className="bg-white text-primary-600 hover:bg-primary-50 font-semibold px-8 py-3 rounded-lg transition-colors inline-block">
            Get Started – It's Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8 px-4 text-center text-sm">
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-xl">🪔</span>
          <span className="text-white font-semibold">Saral Pooja</span>
        </div>
        <p>© {new Date().getFullYear()} Saral Pooja. All rights reserved.</p>
      </footer>
    </div>
  );
}
