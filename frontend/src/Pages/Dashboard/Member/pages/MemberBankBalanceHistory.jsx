import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import api from "../../../../api/axiosInstance";
import { formatAppDate, formatAppDateTime } from "../settingsPreferences";
import "./MemberBankBalanceHistory.css";

/* =========================================================
   FORMATTERS
========================================================= */

const formatBalance = (balance) =>
  `₹${Number(balance).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatAxisBalance = (value) => {
  const n = Number(value);
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(1).replace(/\.0$/, "")}L`;
  if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return `₹${n}`;
};

const formatRecordedAt = (value) => formatAppDateTime(value);

const getErrorMessage = (error, fallback) =>
  error.response?.data?.detail || error.message || fallback;

/* =========================================================
   DATE + WEEK HELPERS  (all in the viewer's local time)
   A "day key" is a plain "YYYY-MM-DD" string, so keys compare correctly as text.
========================================================= */

const pad = (n) => String(n).padStart(2, "0");

const keyOf = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const toDayKey = (value) => {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : keyOf(date);
};

const dateFromKey = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const addDays = (key, days) => {
  const date = dateFromKey(key);
  date.setDate(date.getDate() + days);
  return keyOf(date);
};

const addMonths = (key, months) => {
  const date = dateFromKey(key);
  date.setMonth(date.getMonth() + months);
  return keyOf(date);
};

/** The Monday of the week that contains the given day (weeks run Monday to Sunday). */
const mondayOf = (key) => addDays(key, -((dateFromKey(key).getDay() + 6) % 7));

/** "10 Nov" style label for the chart axis. */
const shortDay = (key) =>
  dateFromKey(key).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

/**
 * Turns the recorded snapshots into one point per week.
 *
 * - Snapshots are saved whenever the balance changes, so a week without a snapshot means
 *   "no change": that week carries the previous balance forward.
 * - Each week reports the closing balance (last record of the week) plus the lowest and
 *   highest balance the member held during it.
 *
 * `snapshots` must be sorted oldest to newest and carry `day` (key) and `amount` (number).
 */
function buildWeekly(snapshots, fromKey, toKey, todayKey) {
  const endKey = toKey || todayKey;
  const inRange = snapshots.filter(
    (s) => (!fromKey || s.day >= fromKey) && s.day <= endKey,
  );

  // Balance the member already had when the range starts
  let carry = null;
  if (fromKey) {
    for (let i = snapshots.length - 1; i >= 0; i -= 1) {
      if (snapshots[i].day < fromKey) {
        carry = snapshots[i].amount;
        break;
      }
    }
  }

  const firstKey = fromKey || inRange[0]?.day;
  if (!firstKey || (inRange.length === 0 && carry === null)) return [];

  const weeks = [];
  let cursor = mondayOf(firstKey);
  const lastMonday = mondayOf(endKey);
  let guard = 0;

  while (cursor <= lastMonday && guard < 1000) {
    const sunday = addDays(cursor, 6);
    const inWeek = inRange.filter((s) => s.day >= cursor && s.day <= sunday);

    if (inWeek.length > 0) {
      const amounts = inWeek.map((s) => s.amount);
      const open = carry;
      const low = Math.min(...amounts, ...(open === null ? [] : [open]));
      const high = Math.max(...amounts, ...(open === null ? [] : [open]));
      const closing = inWeek[inWeek.length - 1].amount;
      weeks.push({ start: cursor, end: sunday, closing, low, high, records: inWeek.length });
      carry = closing;
    } else if (carry !== null) {
      weeks.push({ start: cursor, end: sunday, closing: carry, low: carry, high: carry, records: 0 });
    }

    cursor = addDays(cursor, 7);
    guard += 1;
  }

  return weeks;
}

/* =========================================================
   QUICK RANGES
========================================================= */

const PRESETS = [
  { id: "30d", label: "Last 30 days", range: (today) => [addDays(today, -29), today] },
  { id: "90d", label: "Last 90 days", range: (today) => [addDays(today, -89), today] },
  { id: "6m", label: "Last 6 months", range: (today) => [addMonths(today, -6), today] },
  { id: "1y", label: "Last year", range: (today) => [addMonths(today, -12), today] },
  { id: "all", label: "All time", range: () => ["", ""] },
];

const DEFAULT_PRESET = "90d";

/* =========================================================
   CHART TOOLTIP
========================================================= */

function WeekTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const week = payload[0].payload;

  return (
    <div className="mbh__tip">
      <strong>
        {formatAppDate(week.start)} – {formatAppDate(week.end)}
      </strong>
      <span>Closing balance: <b>{formatBalance(week.closing)}</b></span>
      <span>Lowest: {formatBalance(week.low)}</span>
      <span>Highest: {formatBalance(week.high)}</span>
      <small>
        {week.records === 0
          ? "No change this week"
          : `${week.records} record${week.records === 1 ? "" : "s"} this week`}
      </small>
    </div>
  );
}

/* =========================================================
   PAGE
========================================================= */

export default function MemberBankBalanceHistory() {
  const todayKey = keyOf(new Date());

  const [rawSnapshots, setRawSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  // Date range: "YYYY-MM-DD" or "" (open ended)
  const [preset, setPreset] = useState(DEFAULT_PRESET);
  const [fromDate, setFromDate] = useState(() => PRESETS[1].range(todayKey)[0]);
  const [toDate, setToDate] = useState(() => PRESETS[1].range(todayKey)[1]);

  // Everything the member has recorded (the range is applied on this page, so changing
  // the dates is instant and needs no new request).
  const requestHistory = useCallback(async () => {
    const response = await api.get("/me/bank-balance/history", {
      params: { days: 3650 },
    });

    if (!Array.isArray(response.data)) {
      throw new Error("The server returned an invalid balance history.");
    }

    return response.data;
  }, []);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const history = await requestHistory();
      setRawSnapshots(history);
      return true;
    } catch (loadError) {
      setError(
        getErrorMessage(loadError, "Unable to load available-balance history.")
      );
      return false;
    } finally {
      setLoading(false);
    }
  }, [requestHistory]);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError("");

    requestHistory()
      .then((history) => {
        if (active) {
          setRawSnapshots(history);
          setError("");
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(
            getErrorMessage(loadError, "Unable to load available-balance history.")
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [requestHistory]);

  const recordSnapshot = async () => {
    if (saving) return;

    setSaving(true);
    setSaveError("");
    setSaveMessage("");

    try {
      const response = await api.post("/me/bank-balance/snapshots");
      const refreshed = await loadHistory();

      if (response.data?.created) {
        setSaveMessage(
          refreshed
            ? "Today's available-balance snapshot was saved."
            : "Snapshot saved, but history could not be refreshed."
        );
      } else {
        setSaveMessage(
          refreshed
            ? "Today's snapshot already exists. History has been refreshed."
            : "Today's snapshot already exists, but history could not be refreshed."
        );
      }
    } catch (saveFailure) {
      setSaveError(
        getErrorMessage(
          saveFailure,
          "Unable to save the available-balance snapshot."
        )
      );
    } finally {
      setSaving(false);
    }
  };

  /* ---------- date range controls ---------- */

  const applyPreset = (id) => {
    const [from, to] = PRESETS.find((p) => p.id === id).range(todayKey);
    setPreset(id);
    setFromDate(from);
    setToDate(to);
  };

  // keep the range valid even if a date is typed in by hand
  const changeFrom = (value) => {
    setPreset(null);
    setFromDate(value);
    if (value && toDate && value > toDate) setToDate(value);
  };

  const changeTo = (value) => {
    setPreset(null);
    setToDate(value);
    if (value && fromDate && value < fromDate) setFromDate(value);
  };

  /* ---------- derived data ---------- */

  // Every record, oldest first, with its local calendar day and a numeric balance
  const allSnapshots = useMemo(
    () =>
      rawSnapshots
        .map((s) => ({ ...s, day: toDayKey(s.recorded_at), amount: Number(s.balance) }))
        .filter((s) => s.day),
    [rawSnapshots],
  );

  // Records inside the chosen range (this feeds the table)
  const visibleSnapshots = useMemo(
    () =>
      allSnapshots.filter(
        (s) => (!fromDate || s.day >= fromDate) && (!toDate || s.day <= toDate),
      ),
    [allSnapshots, fromDate, toDate],
  );

  // One point per week for the chart
  const weekly = useMemo(
    () =>
      buildWeekly(allSnapshots, fromDate, toDate, todayKey).map((w) => ({
        ...w,
        label: shortDay(w.start),
      })),
    [allSnapshots, fromDate, toDate, todayKey],
  );

  const stats = useMemo(() => {
    if (weekly.length === 0) return null;
    const lowest = weekly.reduce((a, b) => (b.low < a.low ? b : a));
    const highest = weekly.reduce((a, b) => (b.high > a.high ? b : a));
    const average = weekly.reduce((sum, w) => sum + w.closing, 0) / weekly.length;
    return {
      lowest,
      highest,
      average,
      change: weekly[weekly.length - 1].closing - weekly[0].closing,
    };
  }, [weekly]);

  const latestSnapshot = allSnapshots[allSnapshots.length - 1];

  const rangeText =
    fromDate && toDate
      ? `${formatAppDate(fromDate)} to ${formatAppDate(toDate)}`
      : fromDate
        ? `${formatAppDate(fromDate)} till today`
        : toDate
          ? `up to ${formatAppDate(toDate)}`
          : "all time";

  const changeClass =
    !stats || stats.change === 0
      ? ""
      : stats.change > 0
        ? "mbh__stat-value--up"
        : "mbh__stat-value--down";

  return (
    <section className="mbh" aria-labelledby="mbh-title">
      <div className="mbh__header">
        <div>
          <h2 className="mbh__title" id="mbh-title">
            Available Balance History
          </h2>
          <p className="mbh__subtitle">
            Track the available balance calculated by RS-Sangha.
            This is not a live personal bank-account balance.
          </p>
        </div>
      </div>

      <div className="mbh__latest" aria-live="polite">
        <span className="mbh__latest-label">
          Latest recorded balance
        </span>

        <strong>
          {loading
            ? "Loading..."
            : error
              ? "Unavailable"
              : latestSnapshot
                ? formatBalance(latestSnapshot.balance)
                : "No snapshot"}
        </strong>

        {latestSnapshot && (
          <span className="mbh__latest-date">
            Recorded {formatRecordedAt(latestSnapshot.recorded_at)}
          </span>
        )}
      </div>

      {/* ---------- Date range ---------- */}
      <div className="mbh__filters" role="group" aria-label="Choose a date range">
        <div className="mbh__dates">
          <label className="mbh__range">
            <span>From date</span>
            <input
              type="date"
              value={fromDate}
              max={toDate || todayKey}
              onChange={(event) => changeFrom(event.target.value)}
            />
          </label>

          <label className="mbh__range">
            <span>To date</span>
            <input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              max={todayKey}
              onChange={(event) => changeTo(event.target.value)}
            />
          </label>
        </div>

        <div className="mbh__presets" role="group" aria-label="Quick ranges">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`mbh__chip ${preset === p.id ? "mbh__chip--active" : ""}`}
              onClick={() => applyPreset(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {saveError && (
        <p className="mbh__message mbh__message--error" role="alert">
          {saveError}
        </p>
      )}

      {saveMessage && (
        <p className="mbh__message mbh__message--success" role="status">
          {saveMessage}
        </p>
      )}

      {loading ? (
        <p className="mbh__state" role="status">
          Loading balance history...
        </p>
      ) : error ? (
        <div className="mbh__state mbh__state--error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={loadHistory}>
            Retry
          </button>
        </div>
      ) : allSnapshots.length === 0 ? (
        <p className="mbh__state">
          No recorded balance snapshots yet.
          Your balance history will appear here as soon as it is recorded.
        </p>
      ) : weekly.length === 0 ? (
        <p className="mbh__state">
          No balance was recorded for {rangeText}. Try a wider date range.
        </p>
      ) : (
        <>
          {/* ---------- Summary for the chosen range ---------- */}
          <dl className="mbh__stats">
            <div className="mbh__stat">
              <dt>Lowest balance</dt>
              <dd>{formatBalance(stats.lowest.low)}</dd>
              <small>week of {formatAppDate(stats.lowest.start)}</small>
            </div>
            <div className="mbh__stat">
              <dt>Highest balance</dt>
              <dd>{formatBalance(stats.highest.high)}</dd>
              <small>week of {formatAppDate(stats.highest.start)}</small>
            </div>
            <div className="mbh__stat">
              <dt>Average weekly balance</dt>
              <dd>{formatBalance(stats.average)}</dd>
              <small>{weekly.length} week{weekly.length === 1 ? "" : "s"}</small>
            </div>
            <div className="mbh__stat">
              <dt>Change over this period</dt>
              <dd className={changeClass}>
                {stats.change > 0 ? "+" : stats.change < 0 ? "−" : ""}
                {formatBalance(Math.abs(stats.change))}
              </dd>
              <small>first week to last week</small>
            </div>
          </dl>

          {/* ---------- Weekly chart ---------- */}
          <div className="mbh__chart-head">
            <h3>Weekly balance</h3>
            <p>
              Closing balance of each week (Monday to Sunday), {rangeText}.
              A week with no change keeps the previous balance.
            </p>
          </div>

          {weekly.length > 1 ? (
            <div className="mbh__chart">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart
                  data={weekly}
                  margin={{
                    top: 12,
                    right: 16,
                    bottom: 8,
                    left: 8,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />

                  <XAxis
                    dataKey="label"
                    minTickGap={24}
                    tickMargin={6}
                  />

                  <YAxis
                    tickFormatter={formatAxisBalance}
                    width={64}
                    domain={["auto", "auto"]}
                  />

                  <Tooltip content={<WeekTooltip />} />

                  <Line
                    type="linear"
                    dataKey="closing"
                    name="Closing balance"
                    stroke="#373276"
                    strokeWidth={2}
                    dot={weekly.length <= 40 ? { r: 4 } : false}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="mbh__state">
              Only one week of data falls in this range. Choose a wider range to see a trend.
            </p>
          )}

          {/* ---------- Records table ---------- */}
          <div className="mbh__table-wrap">
            <table className="mbh__table">
              <caption>
                Recorded available-balance snapshots · {rangeText} ·{" "}
                {visibleSnapshots.length} record{visibleSnapshots.length === 1 ? "" : "s"}
              </caption>

              <thead>
                <tr>
                  <th scope="col">Recorded at</th>
                  <th scope="col">Balance</th>
                  <th scope="col">Recorded from</th>
                </tr>
              </thead>

              <tbody>
                {visibleSnapshots.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="mbh__table-empty">
                      No records were saved in this date range.
                    </td>
                  </tr>
                ) : (
                  visibleSnapshots.map((snapshot) => (
                    <tr key={snapshot.id}>
                      <td>{formatRecordedAt(snapshot.recorded_at)}</td>
                      <td>{formatBalance(snapshot.balance)}</td>
                      <td>{snapshot.source}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}