import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';

const app = express();
const port = process.env.PORT || 4000;
const useMemoryFallback = process.env.USE_MEMORY_FALLBACK === 'true';

app.use(cors());
app.use(express.json());

const expenseCategories = ['servicios', 'obligaciones financieras', 'recreación', 'alimentación', 'transporte', 'salud', 'otro'];
const incomeCategories = ['salario', 'entrada extra', 'donación', 'otro'];

const movementSchema = new mongoose.Schema({
  type: { type: String, enum: ['income', 'expense'], required: true },
  amount: { type: Number, required: true, min: 0.01 },
  category: { type: String, required: true },
  date: { type: Date, required: true },
  note: { type: String, trim: true, maxlength: 120 }
}, { timestamps: true });

const settingSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: 'main' },
  initialBalance: { type: Number, min: 0, default: 0 }
}, { timestamps: true });

const Movement = mongoose.model('Movement', movementSchema);
const Setting = mongoose.model('Setting', settingSchema);

const memory = {
  initialBalance: 0,
  movements: []
};

function validateMovement(body) {
  const { type, amount, category, date } = body;
  const categories = type === 'income' ? incomeCategories : expenseCategories;
  if (!['income', 'expense'].includes(type)) return 'El tipo de movimiento no es válido.';
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) return 'El valor debe ser mayor que cero.';
  if (!categories.includes(category)) return 'La categoría no corresponde al tipo elegido.';
  if (!date || Number.isNaN(new Date(date).getTime())) return 'La fecha es obligatoria.';
  return null;
}

function toMovement(body, id = crypto.randomUUID()) {
  return {
    _id: id,
    type: body.type,
    amount: Number(body.amount),
    category: body.category,
    date: new Date(body.date).toISOString(),
    note: body.note?.trim() || ''
  };
}

function calculateSummary(initialBalance, movements) {
  const income = movements.filter((item) => item.type === 'income').reduce((sum, item) => sum + item.amount, 0);
  const expense = movements.filter((item) => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0);
  return {
    initialBalance,
    income,
    expense,
    balance: initialBalance + income - expense,
    movementCount: movements.length
  };
}

async function readInitialBalance() {
  if (useMemoryFallback || mongoose.connection.readyState !== 1) return memory.initialBalance;
  const setting = await Setting.findOne({ key: 'main' }).lean();
  return setting?.initialBalance || 0;
}

async function readMovements(query = {}) {
  if (useMemoryFallback || mongoose.connection.readyState !== 1) {
    return memory.movements.filter((item) => {
      const afterStart = !query.from || item.date.slice(0, 10) >= query.from;
      const beforeEnd = !query.to || item.date.slice(0, 10) <= query.to;
      return afterStart && beforeEnd;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }
  const filter = {};
  if (query.from || query.to) filter.date = {};
  if (query.from) filter.date.$gte = new Date(`${query.from}T00:00:00.000Z`);
  if (query.to) filter.date.$lte = new Date(`${query.to}T23:59:59.999Z`);
  return Movement.find(filter).sort({ date: -1 }).lean();
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, database: mongoose.connection.readyState === 1 ? 'mongodb' : 'memory' });
});

app.get('/api/settings', async (_req, res) => {
  res.json({ initialBalance: await readInitialBalance() });
});

app.put('/api/settings', async (req, res) => {
  const initialBalance = Number(req.body.initialBalance);
  if (!Number.isFinite(initialBalance) || initialBalance < 0) {
    return res.status(400).json({ message: 'El saldo inicial no puede ser negativo.' });
  }
  if (useMemoryFallback || mongoose.connection.readyState !== 1) {
    memory.initialBalance = initialBalance;
  } else {
    await Setting.findOneAndUpdate({ key: 'main' }, { key: 'main', initialBalance }, { upsert: true, new: true });
  }
  return res.json({ initialBalance });
});

app.get('/api/movements', async (req, res) => {
  res.json(await readMovements(req.query));
});

app.post('/api/movements', async (req, res) => {
  const error = validateMovement(req.body);
  if (error) return res.status(400).json({ message: error });
  if (useMemoryFallback || mongoose.connection.readyState !== 1) {
    const movement = toMovement(req.body);
    memory.movements.push(movement);
    return res.status(201).json(movement);
  }
  const movement = await Movement.create({
    type: req.body.type,
    amount: Number(req.body.amount),
    category: req.body.category,
    date: new Date(req.body.date),
    note: req.body.note?.trim() || ''
  });
  return res.status(201).json(movement);
});

app.delete('/api/movements/:id', async (req, res) => {
  if (useMemoryFallback || mongoose.connection.readyState !== 1) {
    const before = memory.movements.length;
    memory.movements = memory.movements.filter((item) => item._id !== req.params.id);
    return before === memory.movements.length ? res.status(404).json({ message: 'Movimiento no encontrado.' }) : res.status(204).end();
  }
  const deleted = await Movement.findByIdAndDelete(req.params.id);
  return deleted ? res.status(204).end() : res.status(404).json({ message: 'Movimiento no encontrado.' });
});

app.get('/api/reports/summary', async (req, res) => {
  const movements = await readMovements(req.query);
  res.json(calculateSummary(await readInitialBalance(), movements));
});

async function start() {
  if (!useMemoryFallback) {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cashflow');
    console.log('MongoDB conectado');
  } else {
    console.log('Modo memoria activo. Define USE_MEMORY_FALLBACK=false para usar MongoDB.');
  }
  app.listen(port, () => console.log(`CashFlow API disponible en http://localhost:${port}`));
}

start().catch((error) => {
  console.error('No fue posible iniciar la API:', error.message);
  process.exit(1);
});
