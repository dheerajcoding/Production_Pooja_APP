/**
 * One-time, manually-run script: seeds the last 10 days with realistic-looking
 * Gurgaon activity (Home Pooja bookings, Temple Pooja bookings, Shop orders)
 * attached to REAL existing users, using REAL listing prices.
 *
 * Does NOT touch any existing document — only inserts new ones.
 * Does NOT fabricate prices — every amount is copied from the actual
 * Pooja/OnlinePooja/Product price at insert time.
 *
 * Run once, manually, from the backend directory:
 *   node scripts/seed-gurgaon-demo.js
 *
 * Writes an audit trail of every inserted _id to seed-gurgaon-demo.audit.json
 * in this same folder, so the run can be identified/reversed later if needed.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const User = require('../models/User');
const Pooja = require('../models/Pooja');
const OnlinePooja = require('../models/OnlinePooja');
const Product = require('../models/Product');
const Pandit = require('../models/Pandit');

const DAYS_BACK = 10;
const HOME_POOJA_PER_DAY = [2, 4];   // inclusive random range
const ONLINE_POOJA_PER_DAY = [1, 2];
const ORDERS_PER_DAY = [1, 2];

const GURGAON_LOCALITIES = [
  { street: 'House 231, Sector 14', pincode: '122001' },
  { street: 'B-12, DLF Phase 3', pincode: '122002' },
  { street: 'Flat 804, Sushant Lok Phase 1', pincode: '122009' },
  { street: '45, Golf Course Road', pincode: '122002' },
  { street: '112, Sohna Road', pincode: '122018' },
  { street: 'C-56, Sector 56', pincode: '122011' },
  { street: 'Tower 4, Cyber City', pincode: '122002' },
  { street: '78, Palam Vihar', pincode: '122017' },
  { street: '23, South City 1', pincode: '122001' },
  { street: 'Plot 9, Sector 29', pincode: '122001' },
  { street: '301, Sector 50', pincode: '122018' },
  { street: '15, MG Road', pincode: '122002' },
];

const BOOKING_TIMES = ['09:00 AM', '10:30 AM', '11:00 AM', '01:00 PM', '03:30 PM', '05:00 PM', '06:30 PM'];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}
function randomId(prefix, len = 14) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[randInt(0, chars.length - 1)];
  return `${prefix}_${s}`;
}
function gurgaonAddress() {
  const loc = pick(GURGAON_LOCALITIES);
  return { street: loc.street, city: 'Gurgaon', state: 'Haryana', pincode: loc.pincode, landmark: '' };
}
function gurgaonAddressString() {
  const loc = pick(GURGAON_LOCALITIES);
  return `${loc.street}, Gurgaon, Haryana ${loc.pincode}`;
}
// Random timestamp on `daysAgo` with a realistic time-of-day, not midnight.
function pastTimestamp(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(randInt(9, 19), pick([0, 15, 30, 45]), randInt(0, 59), 0);
  return d;
}

async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI not found in .env');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB.');

  const users = await User.find({ role: 'user', isActive: true }).select('_id').lean();
  const poojas = await Pooja.find({ isActive: true }).select('_id price').lean();
  const onlinePoojas = await OnlinePooja.find({ isActive: true }).select('_id price').lean();
  const products = await Product.find({ isActive: true, stock: { $gt: 0 } }).select('_id name price discountPrice image').lean();
  const pandits = await Pandit.find({ isApproved: true }).select('_id').lean();

  console.log(`Found: ${users.length} users, ${poojas.length} poojas, ${onlinePoojas.length} online poojas, ${products.length} products, ${pandits.length} approved pandits.`);

  if (!users.length) throw new Error('No active role=user users found — nothing to attach bookings to.');
  if (!poojas.length && !onlinePoojas.length && !products.length) {
    throw new Error('No active poojas/onlinePoojas/products found — nothing to book.');
  }

  const bookingDocs = [];
  const paymentDocs = [];
  const onlineBookingDocs = [];
  const orderDocs = [];

  for (let daysAgo = DAYS_BACK; daysAgo >= 1; daysAgo--) {
    // Home Pooja bookings
    if (poojas.length) {
      const n = randInt(...HOME_POOJA_PER_DAY);
      for (let i = 0; i < n; i++) {
        const user = pick(users);
        const pooja = pick(poojas);
        const createdAt = pastTimestamp(daysAgo);
        const bookingId = new mongoose.Types.ObjectId();
        const paymentId = new mongoose.Types.ObjectId();
        const status = pick(['completed', 'completed', 'completed', 'confirmed']);

        bookingDocs.push({
          _id: bookingId,
          userId: user._id,
          panditId: pandits.length ? pick(pandits)._id : undefined,
          poojaId: pooja._id,
          bookingDate: createdAt,
          bookingTime: pick(BOOKING_TIMES),
          address: gurgaonAddress(),
          status,
          specialRequirements: '',
          amount: pooja.price,
          isPaid: true,
          paymentId,
          completedAt: status === 'completed' ? createdAt : undefined,
          createdAt,
          updatedAt: createdAt,
        });

        paymentDocs.push({
          _id: paymentId,
          bookingId,
          userId: user._id,
          razorpayOrderId: randomId('order'),
          razorpayPaymentId: randomId('pay'),
          razorpaySignature: randomId('sig', 40),
          amount: pooja.price,
          currency: 'INR',
          status: 'captured',
          method: pick(['upi', 'card', 'netbanking']),
          createdAt,
          updatedAt: createdAt,
        });
      }
    }

    // Temple / Online Pooja bookings
    if (onlinePoojas.length) {
      const n = randInt(...ONLINE_POOJA_PER_DAY);
      for (let i = 0; i < n; i++) {
        const user = pick(users);
        const op = pick(onlinePoojas);
        const createdAt = pastTimestamp(daysAgo);
        const status = pick(['completed', 'completed', 'confirmed']);

        onlineBookingDocs.push({
          _id: new mongoose.Types.ObjectId(),
          userId: user._id,
          onlinePoojaId: op._id,
          amount: op.price,
          preferredDate: createdAt,
          gotraName: '',
          wishes: '',
          memberNames: '',
          address: gurgaonAddressString(),
          isPaid: true,
          razorpayOrderId: randomId('order'),
          razorpayPaymentId: randomId('pay'),
          razorpaySignature: randomId('sig', 40),
          status,
          panditId: pandits.length ? pick(pandits)._id : undefined,
          completedAt: status === 'completed' ? createdAt : undefined,
          createdAt,
          updatedAt: createdAt,
        });
      }
    }

    // Shop orders
    if (products.length) {
      const n = randInt(...ORDERS_PER_DAY);
      for (let i = 0; i < n; i++) {
        const user = pick(users);
        const createdAt = pastTimestamp(daysAgo);
        const itemCount = randInt(1, Math.min(3, products.length));
        const chosen = [];
        const usedIdx = new Set();
        while (chosen.length < itemCount) {
          const idx = randInt(0, products.length - 1);
          if (usedIdx.has(idx)) continue;
          usedIdx.add(idx);
          chosen.push(products[idx]);
        }
        const items = chosen.map((p) => {
          const unitPrice = p.discountPrice > 0 ? p.discountPrice : p.price;
          const quantity = randInt(1, 2);
          return { productId: p._id, name: p.name, image: p.image || '', price: unitPrice, quantity };
        });
        const totalAmount = items.reduce((sum, it) => sum + it.price * it.quantity, 0);
        const status = pick(['delivered', 'delivered', 'shipped']);

        orderDocs.push({
          _id: new mongoose.Types.ObjectId(),
          userId: user._id,
          items,
          totalAmount,
          address: gurgaonAddress(),
          status,
          isPaid: true,
          razorpayOrderId: randomId('order'),
          razorpayPaymentId: randomId('pay'),
          razorpaySignature: randomId('sig', 40),
          deliveryNotes: '',
          deliveredAt: status === 'delivered' ? createdAt : undefined,
          createdAt,
          updatedAt: createdAt,
        });
      }
    }
  }

  // Native insertMany bypasses Mongoose's timestamp middleware, so our
  // explicit createdAt/updatedAt values are respected instead of "now".
  const results = {};
  if (bookingDocs.length) {
    const r = await mongoose.connection.collection('bookings').insertMany(bookingDocs);
    results.bookings = Object.values(r.insertedIds).map(String);
  }
  if (paymentDocs.length) {
    const r = await mongoose.connection.collection('payments').insertMany(paymentDocs);
    results.payments = Object.values(r.insertedIds).map(String);
  }
  if (onlineBookingDocs.length) {
    const r = await mongoose.connection.collection('onlinebookings').insertMany(onlineBookingDocs);
    results.onlinebookings = Object.values(r.insertedIds).map(String);
  }
  if (orderDocs.length) {
    const r = await mongoose.connection.collection('orders').insertMany(orderDocs);
    results.orders = Object.values(r.insertedIds).map(String);
  }

  const totalRevenue =
    bookingDocs.reduce((s, b) => s + b.amount, 0) +
    onlineBookingDocs.reduce((s, b) => s + b.amount, 0) +
    orderDocs.reduce((s, o) => s + o.totalAmount, 0);

  console.log('\n=== Seed summary ===');
  console.log(`Home Pooja bookings: ${bookingDocs.length}`);
  console.log(`Payments (for Home Pooja): ${paymentDocs.length}`);
  console.log(`Temple/Online Pooja bookings: ${onlineBookingDocs.length}`);
  console.log(`Shop orders: ${orderDocs.length}`);
  console.log(`Total documents inserted: ${bookingDocs.length + paymentDocs.length + onlineBookingDocs.length + orderDocs.length}`);
  console.log(`Total amount across all new records: ₹${totalRevenue.toLocaleString('en-IN')}`);
  console.log(`Date range: last ${DAYS_BACK} days, ending today`);

  const auditPath = path.join(__dirname, 'seed-gurgaon-demo.audit.json');
  fs.writeFileSync(auditPath, JSON.stringify({ seededAt: new Date().toISOString(), ...results }, null, 2));
  console.log(`\nAudit trail (every inserted _id) written to: ${auditPath}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Seed script failed:', err);
  process.exit(1);
});
