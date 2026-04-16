
import React, { useEffect, useMemo, useState } from "react";

const DAILY_FLOOR = 0;
const TARGET_SEPTEMBER_BALANCE = 200;
const monthOrder = ["abril", "mayo", "junio", "julio", "agosto"];
const monthLabels = { abril:"Abril", mayo:"Mayo", junio:"Junio", julio:"Julio", agosto:"Agosto" };
const weekLabels = ["L", "M", "X", "J", "V", "S", "D"];

const monthConfig = {
  abril: {
    year: 2026, monthIndex: 3, days: 30, salary: 2360, startingBalance: 500,
    scheduled: [
      { day: 16, amount: 35, label: "Gimnasio" },
      { day: 16, amount: 40, label: "Peluquería" },
      { day: 30, amount: 540, label: "Gasto recurrente" },
    ],
  },
  mayo: {
    year: 2026, monthIndex: 4, days: 31, salary: 2360,
    scheduled: [
      { day: 1, amount: 1600 / 3, label: "Mensualidad deuda" },
      { day: 10, amount: 100, label: "Taller" },
      { day: 16, amount: 35, label: "Gimnasio" },
      { day: 16, amount: 40, label: "Peluquería" },
      { day: 31, amount: 540, label: "Gasto recurrente" },
    ],
  },
  junio: {
    year: 2026, monthIndex: 5, days: 30, salary: 2360,
    scheduled: [
      { day: 1, amount: 1600 / 3, label: "Mensualidad deuda" },
      { day: 16, amount: 35, label: "Gimnasio" },
      { day: 16, amount: 40, label: "Peluquería" },
      { day: 30, amount: 540, label: "Gasto recurrente" },
    ],
  },
  julio: {
    year: 2026, monthIndex: 6, days: 31, salary: 2360,
    scheduled: [
      { day: 1, amount: 1600 / 3, label: "Mensualidad deuda" },
      { day: 1, amount: 400, label: "Alquiler" },
      { day: 10, amount: 2000, label: "Amueblar casa" },
      { day: 16, amount: 35, label: "Gimnasio" },
      { day: 16, amount: 40, label: "Peluquería" },
      { day: 31, amount: 540, label: "Gasto recurrente" },
    ],
  },
  agosto: {
    year: 2026, monthIndex: 7, days: 31, salary: 2360,
    scheduled: [
      { day: 1, amount: 400, label: "Alquiler" },
      { day: 16, amount: 35, label: "Gimnasio" },
      { day: 16, amount: 40, label: "Peluquería" },
      { day: 30, amount: 540, label: "Gasto recurrente" },
    ],
  },
};

function getSaturdays(year, monthIndex, daysInMonth) {
  const out = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, monthIndex, d);
    if (dt.getDay() === 6) out.push(d);
  }
  return out;
}
function expandScheduled(cfg) {
  const list = [...cfg.scheduled];
  for (const day of getSaturdays(cfg.year, cfg.monthIndex, cfg.days)) {
    list.push({ day, amount: 30, label: "Gasolina semanal" });
  }
  return list.sort((a, b) => a.day - b.day || a.amount - b.amount);
}
function lastBusinessDay(year, monthIndex) {
  const d = new Date(year, monthIndex + 1, 0);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  return d.getDate();
}
function todayParts() {
  const now = new Date();
  return { year: now.getFullYear(), monthIndex: now.getMonth(), day: now.getDate() };
}
function formatEuros(value) {
  const n = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);
}
function shortEuros(value) {
  const n = Number.isFinite(value) ? value : 0;
  return `${n.toFixed(0)} €`;
}
function loadState() {
  try { const raw = localStorage.getItem("presupuesto_pro_v7"); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function buildMonthTimeline(monthKey, openingBalance, movements) {
  const cfg = monthConfig[monthKey];
  const salaryDay = lastBusinessDay(cfg.year, cfg.monthIndex);
  const scheduled = expandScheduled(cfg);
  const scheduledByDay = {};
  const userByDay = {};

  for (const item of scheduled) {
    if (!scheduledByDay[item.day]) scheduledByDay[item.day] = [];
    scheduledByDay[item.day].push(item);
  }
  for (const m of movements.filter((x) => x.month === monthKey)) {
    const day = Math.min(Math.max(Number(m.day || 1), 1), cfg.days);
    if (!userByDay[day]) userByDay[day] = [];
    userByDay[day].push(m);
  }

  let balance = openingBalance;
  let scheduledTotal = 0;
  let userTotal = 0;
  const days = [];

  for (let day = 1; day <= cfg.days; day++) {
    let salaryIn = 0;
    if (day === salaryDay) {
      salaryIn = cfg.salary;
      balance += salaryIn;
    }
    const scheduledItems = scheduledByDay[day] || [];
    const userItems = userByDay[day] || [];
    const scheduledOut = scheduledItems.reduce((s, x) => s + Number(x.amount || 0), 0);
    const userOut = userItems.reduce((s, x) => s + Number(x.amount || 0), 0);

    balance -= scheduledOut;
    balance -= userOut;
    scheduledTotal += scheduledOut;
    userTotal += userOut;

    days.push({ day, salaryIn, scheduledItems, userItems, scheduledOut, userOut, endBalance: balance });
  }

  return { monthKey, openingBalance, salaryDay, salary: cfg.salary, daysInMonth: cfg.days, scheduledTotal, userTotal, closingBalance: balance, days };
}
function buildPlan(movements) {
  let carry = monthConfig.abril.startingBalance;
  const out = {};
  for (const key of monthOrder) {
    const summary = buildMonthTimeline(key, carry, movements);
    out[key] = summary;
    carry = summary.closingBalance;
  }
  return out;
}
function getCurrentMonthKey() {
  const { monthIndex } = todayParts();
  return monthOrder.find((m) => monthConfig[m].monthIndex === monthIndex) || "abril";
}
function buildGlobalHorizon(plan, fromMonth, fromDay) {
  const startIndex = monthOrder.indexOf(fromMonth);
  const horizon = [];
  for (let i = startIndex; i < monthOrder.length; i++) {
    const monthKey = monthOrder[i];
    const summary = plan[monthKey];
    for (const d of summary.days) {
      if (i === startIndex && d.day < fromDay) continue;
      horizon.push({ monthKey, day: d.day, endBalance: d.endBalance });
    }
  }
  return horizon;
}
function remainingDaysInMonth(plan, monthKey, fromDay) {
  return plan[monthKey].days.filter((d) => d.day >= fromDay).length;
}
function remainingDaysToSeptember(plan, fromMonth, fromDay) {
  return buildGlobalHorizon(plan, fromMonth, fromDay).length;
}
function computeMaxSpendToday(plan, fromMonth, fromDay) {
  const horizon = buildGlobalHorizon(plan, fromMonth, fromDay);
  if (!horizon.length) return 0;
  const minFutureBalance = Math.min(...horizon.map((x) => x.endBalance));
  const finalAugustBalance = plan.agosto.closingBalance;
  const byDailyFloor = Math.max(0, minFutureBalance - DAILY_FLOOR);
  const byFinalTarget = Math.max(0, finalAugustBalance - TARGET_SEPTEMBER_BALANCE);
  return Math.max(0, Math.min(byDailyFloor, byFinalTarget));
}
function computeRecommendedSpendToday(plan, monthKey, day) {
  const maxSpend = computeMaxSpendToday(plan, monthKey, day);
  const monthDays = Math.max(remainingDaysInMonth(plan, monthKey, day), 1);
  const globalDays = Math.max(remainingDaysToSeptember(plan, monthKey, day), 1);
  const monthPart = maxSpend / monthDays;
  const globalPart = maxSpend / globalDays;
  return (monthPart * 0.7) + (globalPart * 0.3);
}
function projectedSeptemberEnd(plan, fromMonth, fromDay) {
  const currentSummary = plan[fromMonth];
  const elapsed = currentSummary.days.filter((d) => d.day <= fromDay);
  const userSoFarCurrentMonth = elapsed.reduce((sum, d) => sum + d.userOut, 0);
  const avgDailyCurrentMonth = userSoFarCurrentMonth / Math.max(fromDay, 1);

  let futureDays = 0;
  for (let i = monthOrder.indexOf(fromMonth); i < monthOrder.length; i++) {
    const key = monthOrder[i];
    const summary = plan[key];
    if (key === fromMonth) futureDays += Math.max(summary.daysInMonth - fromDay, 0);
    else futureDays += summary.daysInMonth;
  }
  return plan.agosto.closingBalance - avgDailyCurrentMonth * futureDays;
}
function rhythmStatus(plan, fromMonth, fromDay) {
  let userSoFar = 0;
  let recommendedAccumulated = 0;

  for (let i = 0; i <= monthOrder.indexOf(fromMonth); i++) {
    const key = monthOrder[i];
    const summary = plan[key];
    const maxDay = key === fromMonth ? fromDay : summary.daysInMonth;
    for (let d = 1; d <= maxDay; d++) {
      userSoFar += summary.days[d - 1].userOut;
      recommendedAccumulated += computeRecommendedSpendToday(plan, key, d);
    }
  }

  if (userSoFar > recommendedAccumulated * 1.2) {
    return { label: "Te estás alejando del objetivo", message: "Tu gasto acumulado va por encima de lo recomendable.", tone: "#dc2626", soft: "#fee2e2", userSoFar, recommendedAccumulated };
  }
  if (userSoFar > recommendedAccumulated * 0.95) {
    return { label: "Vas justo para el objetivo", message: "Vas muy cerca del límite recomendado.", tone: "#d97706", soft: "#fef3c7", userSoFar, recommendedAccumulated };
  }
  return { label: "Vas bien para el objetivo", message: "Tu gasto acumulado va por debajo de lo recomendable.", tone: "#15803d", soft: "#dcfce7", userSoFar, recommendedAccumulated };
}
function topStatus(summary, day, maxSpend, recommended) {
  if (maxSpend <= 0 && day < summary.salaryDay) {
    return { label: "Bloqueado antes de nómina", message: "Cualquier gasto extra te haría romper las reglas antes de cobrar.", tone: "#dc2626", soft: "#fee2e2" };
  }
  if (maxSpend <= 0) {
    return { label: "Sin margen", message: "Hoy no tienes margen si quieres mantener 0 € mínimo diario y 200 € en septiembre.", tone: "#dc2626", soft: "#fee2e2" };
  }
  if (recommended < 15) {
    return { label: "Muy justo", message: "Tienes margen, pero conviene gastar poco para no comerte el colchón.", tone: "#d97706", soft: "#fef3c7" };
  }
  return { label: "Controlado", message: "Tienes margen razonable y sigues respetando tus dos reglas.", tone: "#15803d", soft: "#dcfce7" };
}
function totalEventsForDay(day) { return day.salaryIn || day.scheduledOut || day.userOut; }
function cardStyle(extra = {}) { return { background:"white", borderRadius:24, padding:18, boxShadow:"0 8px 24px rgba(15,23,42,0.06)", ...extra }; }
function inputStyle(extra = {}) { return { width:"100%", padding:13, borderRadius:14, border:"1px solid #dbe1ea", outline:"none", fontSize:15, ...extra }; }
function buttonStyle(primary = false, extra = {}) { return { padding:"12px 14px", borderRadius:14, border: primary ? "none" : "1px solid #dbe1ea", background: primary ? "#0f172a" : "white", color: primary ? "white" : "#0f172a", fontWeight:600, cursor:"pointer", ...extra }; }
function pillStyle(active) { return { borderRadius:999, padding:"10px 14px", border: active ? "none" : "1px solid #dbe1ea", background: active ? "#0f172a" : "white", color: active ? "white" : "#0f172a", cursor:"pointer", whiteSpace:"nowrap", fontWeight:600 }; }
function Row({ label, value }) { return <div style={{ display:"flex", justifyContent:"space-between", gap:10 }}><span style={{ color:"#475569" }}>{label}</span><strong>{value}</strong></div>; }

function buildCalendarCells(monthKey, summary, plan, currentMonthKey, currentDay) {
  const cfg = monthConfig[monthKey];
  const first = new Date(cfg.year, cfg.monthIndex, 1);
  const mondayIndex = (first.getDay() + 6) % 7;
  const cells = Array.from({ length: mondayIndex }, () => null);

  for (let day = 1; day <= cfg.days; day++) {
    const recommended = computeRecommendedSpendToday(plan, monthKey, day);
    const isPast =
      monthConfig[monthKey].monthIndex < monthConfig[currentMonthKey].monthIndex ||
      (monthKey === currentMonthKey && day < currentDay);

    cells.push({
      day,
      recommended,
      isPast,
      isToday: monthKey === currentMonthKey && day === currentDay,
    });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function App() {
  const saved = typeof window !== "undefined" ? loadState() : null;
  const currentMonth = getCurrentMonthKey();
  const [selectedMonth, setSelectedMonth] = useState(saved?.selectedMonth || currentMonth);
  const [movements, setMovements] = useState(Array.isArray(saved?.movements) ? saved.movements : []);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [expenseDay, setExpenseDay] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem("presupuesto_pro_v7", JSON.stringify({ selectedMonth, movements }));
      setSavedMessage("Guardado automático activado");
      const t = setTimeout(() => setSavedMessage(""), 1300);
      return () => clearTimeout(t);
    } catch {}
  }, [selectedMonth, movements]);

  const plan = useMemo(() => buildPlan(movements), [movements]);
  const summary = plan[selectedMonth];
  const now = todayParts();
  const visibleDay = monthConfig[selectedMonth].monthIndex === now.monthIndex ? now.day : 1;

  const maxSpendToday = computeMaxSpendToday(plan, selectedMonth, visibleDay);
  const recommendedToday = computeRecommendedSpendToday(plan, selectedMonth, visibleDay);
  const projection = projectedSeptemberEnd(plan, selectedMonth, visibleDay);
  const septemberBalance = plan.agosto.closingBalance;
  const todayLine = summary.days.find((d) => d.day === visibleDay) || summary.days[0];
  const headerStatus = topStatus(summary, visibleDay, maxSpendToday, recommendedToday);
  const pace = rhythmStatus(plan, selectedMonth, visibleDay);

  const calendars = monthOrder.map((monthKey) => ({
    monthKey,
    cells: buildCalendarCells(monthKey, plan[monthKey], plan, currentMonth, now.day),
  }));

  const addExpense = () => {
    const value = parseFloat(String(amount).replace(",", "."));
    const day = Number(expenseDay || visibleDay);
    if (!(value > 0)) return;
    if (!(day >= 1 && day <= monthConfig[selectedMonth].days)) return;
    setMovements((prev) => [{ id: Date.now(), month: selectedMonth, day, amount: value, note: note || "Gasto" }, ...prev]);
    setAmount(""); setNote(""); setExpenseDay("");
  };

  const removeExpense = (id) => setMovements((prev) => prev.filter((m) => m.id !== id));
  const clearMonthExpenses = () => setMovements((prev) => prev.filter((m) => m.month !== selectedMonth));

  const monthMovements = movements.filter((m) => m.month === selectedMonth).sort((a, b) => a.day - b.day || a.id - b.id);

  return (
    <div style={{ minHeight:"100vh", padding:16, background:"#f6f8fb" }}>
      <div style={{ maxWidth:1100, margin:"0 auto", display:"grid", gap:14 }}>
        <div style={{ display:"grid", gap:4 }}>
          <div style={{ fontSize:13, fontWeight:700, color:"#475569", letterSpacing:0.3 }}>PRESUPUESTO PRO V7</div>
          <h1 style={{ margin:0, fontSize:30, lineHeight:1.05 }}>Calendarios diarios de gasto recomendado</h1>
          <div style={{ color:"#64748b", fontSize:15 }}>Cada día muestra su gasto recomendado teniendo en cuenta pasado + futuro, con 0 € mínimo diario y 200 € al 1 de septiembre.</div>
        </div>

        <div style={{ ...cardStyle(), paddingBottom:14 }}>
          <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:4 }}>
            {monthOrder.map((m) => <button key={m} onClick={() => setSelectedMonth(m)} style={pillStyle(selectedMonth === m)}>{monthLabels[m]}</button>)}
          </div>
          <div style={{ marginTop:12, display:"flex", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
            <div style={{ fontSize:14, color:"#475569" }}>Día usado para cálculo principal: <strong>{visibleDay}</strong></div>
            <div style={{ fontSize:14, color:"#475569" }}>Días restantes hasta septiembre: <strong>{remainingDaysToSeptember(plan, selectedMonth, visibleDay)}</strong></div>
            <div style={{ fontSize:12, color:"#64748b" }}>{savedMessage}</div>
          </div>
        </div>

        <div style={{ ...cardStyle(), background:`linear-gradient(135deg, ${headerStatus.soft} 0%, white 100%)`, border:`1px solid ${headerStatus.soft}` }}>
          <div style={{ display:"flex", justifyContent:"space-between", gap:10, alignItems:"start", flexWrap:"wrap" }}>
            <div>
              <div style={{ fontSize:13, color:"#475569", fontWeight:700 }}>HOY</div>
              <div style={{ fontSize:28, fontWeight:800, marginTop:6 }}>
                {recommendedToday <= 0 ? "HOY no deberías gastar" : `Hoy te conviene gastar como máximo ${formatEuros(recommendedToday)}`}
              </div>
              <div style={{ marginTop:8, color:"#475569", fontSize:14 }}>{headerStatus.message}</div>
            </div>
            <div style={{ background:headerStatus.tone, color:"white", padding:"8px 12px", borderRadius:999, fontSize:13, fontWeight:700 }}>{headerStatus.label}</div>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:12 }}>
          <div style={cardStyle()}>
            <div style={{ fontSize:12, color:"#64748b" }}>Máximo real hoy</div>
            <div style={{ marginTop:8, fontSize:24, fontWeight:800 }}>{formatEuros(maxSpendToday)}</div>
          </div>
          <div style={cardStyle()}>
            <div style={{ fontSize:12, color:"#64748b" }}>Recomendado hoy</div>
            <div style={{ marginTop:8, fontSize:24, fontWeight:800 }}>{formatEuros(recommendedToday)}</div>
          </div>
          <div style={cardStyle()}>
            <div style={{ fontSize:12, color:"#64748b" }}>Saldo real hoy</div>
            <div style={{ marginTop:8, fontSize:24, fontWeight:800 }}>{formatEuros(todayLine.endBalance)}</div>
          </div>
          <div style={cardStyle()}>
            <div style={{ fontSize:12, color:"#64748b" }}>Si sigues así llegarás con</div>
            <div style={{ marginTop:8, fontSize:24, fontWeight:800 }}>{projection < 0 ? "En negativo" : formatEuros(projection)}</div>
          </div>
        </div>

        <div style={cardStyle()}>
          <div style={{ fontSize:18, fontWeight:800, marginBottom:12 }}>Calendarios abril → agosto</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))", gap:14 }}>
            {calendars.map(({ monthKey, cells }) => (
              <div key={monthKey} style={{ border:"1px solid #e8edf3", borderRadius:18, padding:12 }}>
                <div style={{ fontWeight:800, marginBottom:10 }}>{monthLabels[monthKey]}</div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:6, marginBottom:6 }}>
                  {weekLabels.map((w) => (
                    <div key={w} style={{ fontSize:12, color:"#64748b", textAlign:"center", fontWeight:700 }}>{w}</div>
                  ))}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:6 }}>
                  {cells.map((cell, idx) => {
                    if (!cell) return <div key={idx} />;
                    return (
                      <div
                        key={idx}
                        style={{
                          minHeight: 70,
                          borderRadius: 14,
                          border: cell.isToday ? "2px solid #0f172a" : "1px solid #e8edf3",
                          background: cell.isPast ? "#f8fafc" : "white",
                          padding: 8,
                          opacity: cell.isPast ? 0.75 : 1,
                        }}
                      >
                        <div style={{ fontSize:12, fontWeight:800 }}>{cell.day}</div>
                        <div style={{ marginTop:6, fontSize:13, fontWeight:700, color: cell.recommended <= 0 ? "#b91c1c" : "#0f172a" }}>
                          {cell.recommended <= 0 ? "0 €" : shortEuros(cell.recommended)}
                        </div>
                        <div style={{ marginTop:4, fontSize:10, color:"#64748b" }}>recomendado</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ ...cardStyle(), background:`linear-gradient(135deg, ${pace.soft} 0%, white 100%)`, border:`1px solid ${pace.soft}` }}>
          <div style={{ display:"flex", justifyContent:"space-between", gap:10, alignItems:"start", flexWrap:"wrap" }}>
            <div>
              <div style={{ fontSize:13, color:"#475569", fontWeight:700 }}>RITMO HACIA EL OBJETIVO</div>
              <div style={{ fontSize:24, fontWeight:800, marginTop:6 }}>{pace.label}</div>
              <div style={{ marginTop:8, color:"#475569", fontSize:14 }}>{pace.message}</div>
            </div>
            <div style={{ textAlign:"right", fontSize:14 }}>
              <div>Gastado acumulado: <strong>{formatEuros(pace.userSoFar)}</strong></div>
              <div style={{ marginTop:6 }}>Recomendado acumulado: <strong>{formatEuros(pace.recommendedAccumulated)}</strong></div>
            </div>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:12 }}>
          <div style={cardStyle()}>
            <div style={{ fontSize:18, fontWeight:800, marginBottom:12 }}>Resumen del mes visible</div>
            <div style={{ display:"grid", gap:10, fontSize:14 }}>
              <Row label="Saldo al empezar" value={formatEuros(summary.openingBalance)} />
              <Row label="Último día laborable" value={String(summary.salaryDay)} />
              <Row label="Nómina del mes" value={formatEuros(summary.salary)} />
              <Row label="Comprometido programado" value={formatEuros(summary.scheduledTotal)} />
              <Row label="Tus gastos registrados" value={formatEuros(summary.userTotal)} />
              <Row label="Saldo al cerrar" value={formatEuros(summary.closingBalance)} />
              <Row label="Saldo previsto 1 septiembre" value={formatEuros(septemberBalance)} />
            </div>
          </div>

          <div style={cardStyle()}>
            <div style={{ fontSize:18, fontWeight:800, marginBottom:12 }}>Añadir gasto real</div>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Importe en €" style={inputStyle()} />
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Concepto" style={{ ...inputStyle(), marginTop:10 }} />
            <input value={expenseDay} onChange={(e) => setExpenseDay(e.target.value)} placeholder={`Día del mes (por defecto ${visibleDay})`} type="number" min="1" max={monthConfig[selectedMonth].days} style={{ ...inputStyle(), marginTop:10 }} />
            <button onClick={addExpense} style={{ ...buttonStyle(true), marginTop:10, width:"100%" }}>Guardar gasto</button>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))", gap:12 }}>
          <div style={cardStyle()}>
            <div style={{ display:"flex", justifyContent:"space-between", gap:10, alignItems:"center", marginBottom:12 }}>
              <div style={{ fontSize:18, fontWeight:800 }}>Eventos del mes</div>
              <div style={{ fontSize:13, color:"#64748b" }}>{monthLabels[selectedMonth]}</div>
            </div>
            <div style={{ maxHeight:420, overflow:"auto", display:"grid", gap:10, paddingRight:4 }}>
              {summary.days.filter(totalEventsForDay).map((d) => (
                <div key={d.day} style={{ border:"1px solid #e8edf3", borderRadius:16, padding:12 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", gap:10 }}>
                    <strong>Día {d.day}</strong>
                    <span style={{ fontSize:13, color:"#475569" }}>Saldo fin del día {formatEuros(d.endBalance)}</span>
                  </div>
                  {d.salaryIn > 0 && <div style={{ marginTop:8, color:"#15803d", fontWeight:600 }}>+ Nómina {formatEuros(d.salaryIn)}</div>}
                  {d.scheduledItems.map((item, idx) => <div key={idx} style={{ marginTop:6, color:"#92400e" }}>- {item.label}: {formatEuros(item.amount)}</div>)}
                  {d.userItems.map((item) => <div key={item.id} style={{ marginTop:6, color:"#0f172a" }}>- {item.note}: {formatEuros(item.amount)}</div>)}
                </div>
              ))}
            </div>
          </div>

          <div style={cardStyle()}>
            <div style={{ display:"flex", justifyContent:"space-between", gap:10, alignItems:"center", marginBottom:12 }}>
              <div style={{ fontSize:18, fontWeight:800 }}>Tus gastos del mes</div>
              <button onClick={clearMonthExpenses} style={buttonStyle(false)}>Borrar mes</button>
            </div>
            {monthMovements.length === 0 ? <div style={{ fontSize:14, color:"#64748b" }}>No has añadido gastos manuales en este mes.</div> : (
              <div style={{ display:"grid", gap:10 }}>
                {monthMovements.map((m) => (
                  <div key={m.id} style={{ border:"1px solid #e8edf3", borderRadius:16, padding:12, display:"flex", justifyContent:"space-between", gap:12, alignItems:"center" }}>
                    <div><div style={{ fontWeight:700 }}>{m.note}</div><div style={{ fontSize:13, color:"#64748b" }}>Día {m.day}</div></div>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}><div style={{ fontWeight:800 }}>{formatEuros(m.amount)}</div><button onClick={() => removeExpense(m.id)} style={buttonStyle(false, { padding:"8px 10px" })}>Eliminar</button></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
