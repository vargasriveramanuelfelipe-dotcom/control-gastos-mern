import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, CalendarDays, Check, CircleDollarSign, Filter, Landmark, Plus, RefreshCw, Trash2, WalletCards } from 'lucide-react';

const API_URL = 'http://localhost:4000/api';
const incomeCategories = ['salario', 'entrada extra', 'donación', 'otro'];
const expenseCategories = ['servicios', 'obligaciones financieras', 'recreación', 'alimentación', 'transporte', 'salud', 'otro'];
const today = new Date().toISOString().slice(0, 10);

const money = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const dateLabel = (value) => {
  const dateOnly = String(value).slice(0, 10);
  return new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${dateOnly}T12:00:00`));
};

async function request(path, options) {
  const response = await fetch(`${API_URL}${path}`, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || 'No se pudo completar la solicitud.');
  }
  return response.status === 204 ? null : response.json();
}

function App() {
  const [initialBalance, setInitialBalance] = useState(0);
  const [summary, setSummary] = useState({ initialBalance: 0, income: 0, expense: 0, balance: 0, movementCount: 0 });
  const [movements, setMovements] = useState([]);
  const [filters, setFilters] = useState({ from: '', to: '' });
  const [form, setForm] = useState({ type: 'expense', amount: '', category: expenseCategories[0], date: today, note: '' });
  const [status, setStatus] = useState({ loading: true, saving: false, error: '', success: '' });

  const categories = form.type === 'income' ? incomeCategories : expenseCategories;
  const categoryTotals = useMemo(() => {
    const totals = movements.reduce((accumulator, movement) => {
      accumulator[movement.category] = (accumulator[movement.category] || 0) + movement.amount;
      return accumulator;
    }, {});
    return Object.entries(totals).sort(([, first], [, second]) => second - first).slice(0, 5);
  }, [movements]);

  async function loadDashboard(nextFilters = filters) {
    setStatus((current) => ({ ...current, loading: true, error: '' }));
    const query = new URLSearchParams(Object.entries(nextFilters).filter(([, value]) => value));
    try {
      const [settings, nextSummary, nextMovements] = await Promise.all([
        request('/settings'),
        request(`/reports/summary?${query}`),
        request(`/movements?${query}`)
      ]);
      setInitialBalance(settings.initialBalance);
      setSummary(nextSummary);
      setMovements(nextMovements);
    } catch (error) {
      setStatus((current) => ({ ...current, error: error.message }));
    } finally {
      setStatus((current) => ({ ...current, loading: false }));
    }
  }

  useEffect(() => { loadDashboard(); }, []);

  function updateForm(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function changeType(type) {
    setForm((current) => ({ ...current, type, category: type === 'income' ? incomeCategories[0] : expenseCategories[0] }));
  }

  async function saveInitialBalance(event) {
    event.preventDefault();
    setStatus((current) => ({ ...current, saving: true, error: '', success: '' }));
    try {
      await request('/settings', { method: 'PUT', body: JSON.stringify({ initialBalance }) });
      await loadDashboard();
      setStatus((current) => ({ ...current, success: 'Saldo inicial actualizado.', saving: false }));
    } catch (error) {
      setStatus((current) => ({ ...current, error: error.message, saving: false }));
    }
  }

  async function resetAccount() {
    const confirmed = window.confirm('Esto eliminará todos los movimientos y dejará el saldo inicial en cero. ¿Deseas continuar?');
    if (!confirmed) return;

    setStatus((current) => ({ ...current, saving: true, error: '', success: '' }));
    try {
      await request('/account/reset', { method: 'POST' });
      setInitialBalance(0);
      await loadDashboard();
      setStatus((current) => ({ ...current, success: 'Cuenta reiniciada. Se eliminaron los movimientos y el saldo quedó en cero.', saving: false }));
    } catch (error) {
      setStatus((current) => ({ ...current, error: error.message, saving: false }));
    }
  }

  async function saveMovement(event) {
    event.preventDefault();
    setStatus((current) => ({ ...current, saving: true, error: '', success: '' }));
    try {
      await request('/movements', { method: 'POST', body: JSON.stringify(form) });
      setForm((current) => ({ ...current, amount: '', note: '' }));
      await loadDashboard();
      setStatus((current) => ({ ...current, success: 'Movimiento registrado correctamente.', saving: false }));
    } catch (error) {
      setStatus((current) => ({ ...current, error: error.message, saving: false }));
    }
  }

  async function deleteMovement(id) {
    try {
      await request(`/movements/${id}`, { method: 'DELETE' });
      await loadDashboard();
      setStatus((current) => ({ ...current, success: 'Movimiento eliminado.', error: '' }));
    } catch (error) {
      setStatus((current) => ({ ...current, error: error.message }));
    }
  }

  function applyFilters(event) {
    event.preventDefault();
    loadDashboard(filters);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#inicio"><span className="brand-mark"><WalletCards size={20} /></span><span>cash<span>flow</span></span></a>
        <nav><a href="#movimientos">Movimientos</a><a href="#reportes">Reportes</a></nav>
        <div className="profile"><span className="profile-dot">CF</span><span>Mi cuenta</span></div>
      </header>

      <main id="inicio" className="content">
        <section className="intro"><div><p className="eyebrow">Panel financiero personal</p><h1>Tu dinero, <em>más claro.</em></h1><p className="intro-copy">Registra cada movimiento y toma decisiones con una vista honesta de tu flujo de caja.</p></div><div className="date-stamp"><CalendarDays size={16} /> {new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</div></section>

        {status.error && <div className="alert error">{status.error}</div>}
        {status.success && <div className="alert success"><Check size={16} /> {status.success}</div>}

        <section className="summary-grid" aria-label="Resumen financiero">
          <article className="balance-card"><div className="card-kicker"><span>Saldo disponible</span><CircleDollarSign size={18} /></div><strong>{money.format(summary.balance)}</strong><div className="balance-foot"><span><span className="status-pulse" /> Actualizado ahora</span><span>{summary.movementCount} movimientos</span></div></article>
          <article className="metric-card income-card"><div className="metric-icon"><ArrowDownLeft size={18} /></div><div><span>Ingresos del periodo</span><strong>{money.format(summary.income)}</strong><small>Entradas registradas</small></div></article>
          <article className="metric-card expense-card"><div className="metric-icon"><ArrowUpRight size={18} /></div><div><span>Gastos del periodo</span><strong>{money.format(summary.expense)}</strong><small>Salidas registradas</small></div></article>
        </section>

        <section className="workspace-grid" id="movimientos">
          <article className="panel form-panel"><div className="panel-heading"><div><p className="eyebrow">Nuevo registro</p><h2>Añadir movimiento</h2></div><span className="panel-number">01</span></div><div className="type-toggle"><button className={form.type === 'expense' ? 'active expense' : ''} type="button" onClick={() => changeType('expense')}><ArrowUpRight size={16} /> Gasto</button><button className={form.type === 'income' ? 'active income' : ''} type="button" onClick={() => changeType('income')}><ArrowDownLeft size={16} /> Ingreso</button></div><form onSubmit={saveMovement}><label>Valor<input required min="1" name="amount" type="number" placeholder="$ 0" value={form.amount} onChange={updateForm} /></label><div className="two-fields"><label>Fecha<input required name="date" type="date" value={form.date} onChange={updateForm} /></label><label>Categoría<select name="category" value={form.category} onChange={updateForm}>{categories.map((category) => <option key={category} value={category}>{category[0].toUpperCase() + category.slice(1)}</option>)}</select></label></div><label>Nota <span className="optional">(opcional)</span><input maxLength="120" name="note" type="text" placeholder="Ej. Compra del mercado" value={form.note} onChange={updateForm} /></label><button className="primary-button" disabled={status.saving} type="submit"><Plus size={18} /> {status.saving ? 'Guardando...' : 'Guardar movimiento'}</button></form></article>

          <article className="panel balance-panel"><div className="panel-heading"><div><p className="eyebrow">Configuración</p><h2>Saldo inicial</h2></div><span className="panel-number">02</span></div><p className="panel-description">Define el punto de partida de tu cuenta para que cada movimiento se refleje en el balance.</p><form className="initial-form" onSubmit={saveInitialBalance}><label>Saldo de apertura<input min="0" step="1" type="number" value={initialBalance} onChange={(event) => setInitialBalance(event.target.value)} /></label><button className="secondary-button" disabled={status.saving} type="submit">Actualizar saldo</button></form><button className="danger-button" disabled={status.saving} onClick={resetAccount} type="button"><Trash2 size={16} /> {status.saving ? 'Procesando...' : 'Reiniciar saldo y movimientos'}</button><div className="mini-balance"><Landmark size={18} /><div><span>Base actual</span><strong>{money.format(summary.initialBalance)}</strong></div></div><div className="category-breakdown"><div className="breakdown-title"><span>Distribución del periodo</span><span>{categoryTotals.length} categorías</span></div>{categoryTotals.length ? categoryTotals.map(([category, total]) => <div className="breakdown-row" key={category}><span>{category}</span><strong>{money.format(total)}</strong></div>) : <p className="empty-copy">Aún no hay datos para mostrar.</p>}</div></article>
        </section>

        <section className="panel movements-panel" id="reportes"><div className="table-heading"><div><p className="eyebrow">Actividad de cuenta</p><h2>Reporte de movimientos</h2></div><form className="filters" onSubmit={applyFilters}><Filter size={16} /><input aria-label="Desde" type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /><span>hasta</span><input aria-label="Hasta" type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /><button title="Aplicar filtros" type="submit"><RefreshCw size={16} /></button></form></div><div className="table-wrap"><table><thead><tr><th>Movimiento</th><th>Categoría</th><th>Fecha</th><th className="amount-column">Valor</th><th aria-label="Acciones" /></tr></thead><tbody>{status.loading ? <tr><td className="table-message" colSpan="5">Cargando movimientos...</td></tr> : movements.length ? movements.map((movement) => <tr key={movement._id}><td><span className={`movement-icon ${movement.type}`} >{movement.type === 'income' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</span><span><strong>{movement.note || (movement.type === 'income' ? 'Ingreso registrado' : 'Gasto registrado')}</strong><small>{movement.type === 'income' ? 'Entrada' : 'Salida'}</small></span></td><td><span className="category-pill">{movement.category}</span></td><td>{dateLabel(movement.date)}</td><td className={`amount ${movement.type}`}>{movement.type === 'income' ? '+' : '-'} {money.format(movement.amount)}</td><td><button className="icon-button" title="Eliminar movimiento" onClick={() => deleteMovement(movement._id)}><Trash2 size={16} /></button></td></tr>) : <tr><td className="table-message" colSpan="5">No hay movimientos en este rango de fechas.</td></tr>}</tbody></table></div></section>
      </main>
      <footer><span>cashflow / control sencillo para decisiones mejores</span><span>Datos locales de tu cuenta</span></footer>
    </div>
  );
}

export default App;
