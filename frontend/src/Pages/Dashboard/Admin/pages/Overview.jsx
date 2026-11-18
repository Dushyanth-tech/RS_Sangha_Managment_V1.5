/**
 * Admin Dashboard · Overview
 *
 * Shows, for the sanghas managed by the logged-in admin:
 *   - membership and seat capacity
 *   - savings account balances
 *   - loan (fund) requests and approvals
 *   - weekly money flow (confirmed transactions only)
 *
 * Data sources
 *   GET /sanghas                       sangha list with member counts
 *   GET /admin-requests/pending-count  admin requests awaiting super admin
 *   GET /admin/overview                savings, loans and weekly money flow
 */

import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  BadgeCheck,
  Building2,
  Check,
  ClipboardList,
  HandCoins,
  PiggyBank,
  UserCheck,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import api from "../../../../api/axiosInstance";
import "./Overview.css";

/* =========================================================
   CONSTANTS
========================================================= */

/** Matches the 20-member limit enforced by the backend. */
const SANGHA_CAPACITY = 20;

/** Number of weeks shown in the money flow chart. */
const WEEKS_SHOWN = 8;

const COLORS = {
  primary: "#4f46a5",
  primarySoft: "#c7c3ee",
};

/* =========================================================
   HELPERS
========================================================= */

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}") || {};
  } catch {
    return {};
  }
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

/** Formats a number as Indian rupees, e.g. 125000 -> ₹1,25,000 */
const formatINR = (amount) =>
  `₹${Number(amount || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;

/** Compact axis label, e.g. 12500 -> ₹13k */
const formatAxisINR = (value) =>
  value >= 1000 ? `₹${Math.round(value / 1000)}k` : `₹${value}`;

const pluralize = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** The API may return camelCase or snake_case member counts. */
const getMembersCount = (sangha) =>
  Number(sangha.membersCount ?? sangha.members_count ?? 0);

const sumBy = (items, key) =>
  items.reduce((total, item) => total + Number(item[key] || 0), 0);

/* =========================================================
   DATA HOOKS
========================================================= */

/** Fetches once on mount and exposes { data, loading, failed }. */
function useApiData(url, select) {
  const [state, setState] = useState({
    data: null,
    loading: true,
    failed: false,
  });

  useEffect(() => {
    let cancelled = false;

    api
      .get(url)
      .then((res) => {
        if (!cancelled)
          setState({ data: select(res.data), loading: false, failed: false });
      })
      .catch(() => {
        if (!cancelled) setState({ data: null, loading: false, failed: true });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return state;
}

/** Finance data for the selected sangha ("" = all managed sanghas). */
function useAdminOverview(sanghaId) {
  const [state, setState] = useState({
    data: null,
    loading: true,
    failed: false,
  });

  useEffect(() => {
    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, failed: false }));

    api
      .get("/admin/overview", {
        params: {
          weeks: WEEKS_SHOWN,
          ...(sanghaId ? { sangha_id: sanghaId } : {}),
        },
      })
      .then((res) => {
        if (!cancelled)
          setState({ data: res.data, loading: false, failed: false });
      })
      .catch(() => {
        if (!cancelled)
          setState((prev) => ({ ...prev, loading: false, failed: true }));
      });

    return () => {
      cancelled = true;
    };
  }, [sanghaId]);

  return state;
}

/* =========================================================
   SMALL PRESENTATIONAL COMPONENTS
========================================================= */

function StatTile({ icon: Icon, label, value, loading, failed, attention }) {
  return (
    <div className="ao-stat">
      <div
        className={`ao-stat__icon ${attention ? "ao-stat__icon--attention" : ""}`}
      >
        <Icon size={20} strokeWidth={2} />
      </div>

      <div className="ao-stat__body">
        <span className="ao-stat__label">{label}</span>
        {loading ? (
          <span className="ao-skeleton ao-skeleton--value" />
        ) : (
          <span className="ao-stat__value">{failed ? "—" : value}</span>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  title,
  value,
  description,
  loading = false,
  failed = false,
  attention = false,
}) {
  return (
    <div className="ao-summary-card">
      <div
        className={`ao-summary-card__icon ${
          attention ? "ao-summary-card__icon--attention" : ""
        }`}
      >
        <Icon size={20} strokeWidth={2} />
      </div>

      <div className="ao-summary-card__content">
        <span className="ao-summary-card__label">{title}</span>

        {loading ? (
          <span className="ao-skeleton ao-skeleton--value" />
        ) : (
          <strong className="ao-summary-card__value">
            {failed ? "—" : value}
          </strong>
        )}

        {description && (
          <span className="ao-summary-card__description">{description}</span>
        )}
      </div>
    </div>
  );
}

function FeatureSection({ eyebrow, title, text, icon: Icon, children }) {
  return (
    <section className="ao-feature-section">
      <div className="ao-feature-section__header">
        <div>
          <p className="ao-chart-card__eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          <p>{text}</p>
        </div>
        <div className="ao-feature-icon">
          <Icon size={22} />
        </div>
      </div>
      {children}
    </section>
  );
}

function ProgressBar({ value, max, label, large = false, full = false }) {
  const percent = max ? Math.min(100, Math.round((value / max) * 100)) : 0;

  return (
    <div
      className={`ao-bar ${large ? "ao-bar--lg" : ""}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
    >
      <div
        className={`ao-bar__fill ${full ? "ao-bar__fill--full" : ""}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

function ChartMessage({ children, loading = false }) {
  return (
    <div className={loading ? "ao-chart-loading" : "ao-chart-empty"}>
      {children}
    </div>
  );
}

function EmptyState({ icon: Icon, title, text }) {
  return (
    <div className="ao-feature-empty">
      <Icon size={24} strokeWidth={1.8} />
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </div>
  );
}

/* =========================================================
   SECTION COMPONENTS
========================================================= */

function Header({ greeting, firstName, sanghaLine }) {
  return (
    <header className="ao-header">
      <p className="ao-header__eyebrow">Admin Dashboard</p>

      <h1 className="ao-header__title">
        {greeting}
        {firstName ? `, ${firstName}` : ""}
      </h1>

      {sanghaLine && (
        <p className="ao-header__sub">
          <Building2 size={15} strokeWidth={2} />
          <span>{sanghaLine}</span>
        </p>
      )}
    </header>
  );
}

function MembershipChart({ sanghas, totalMembers, loading, failed }) {
  const data = sanghas.map((s) => ({
    name: s.name,
    members: getMembersCount(s),
  }));

  let body;
  if (loading) {
    body = <ChartMessage loading>Loading membership chart...</ChartMessage>;
  } else if (failed) {
    body = <ChartMessage>Unable to load membership data.</ChartMessage>;
  } else if (sanghas.length === 0) {
    body = <ChartMessage>No Sangha data available.</ChartMessage>;
  } else {
    body = (
      <div className="ao-chart">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              allowDecimals={false}
              domain={[0, SANGHA_CAPACITY]}
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              cursor={{ opacity: 0.08 }}
              formatter={(value) => [`${value} members`, "Members"]}
            />
            <Bar
              dataKey="members"
              name="Members"
              fill={COLORS.primary}
              radius={[6, 6, 0, 0]}
              maxBarSize={55}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <section className="ao-charts">
      <div className="ao-chart-card">
        <div className="ao-chart-card__header">
          <div>
            <p className="ao-chart-card__eyebrow">Membership</p>
            <h2>Sangha Members</h2>
          </div>
          <div className="ao-chart-card__badge">
            <Users size={16} />
            <span>{totalMembers} members</span>
          </div>
        </div>
        {body}
      </div>
    </section>
  );
}

function SanghaFilter({ sanghas, value, onChange }) {
  if (sanghas.length < 2) return null;

  return (
    <div className="ao-filter">
      <label htmlFor="ao-sangha-filter">Money overview for</label>
      <select
        id="ao-sangha-filter"
        className="ao-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">All my sanghas</option>
        {sanghas.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function MoneyFlowChart({ weekly, scopeName, loading, failed }) {
  const periodTotal = sumBy(weekly, "total");
  const periodIn = sumBy(weekly, "moneyIn");
  const periodOut = sumBy(weekly, "moneyOut");

  let body;
  if (loading) {
    body = <ChartMessage loading>Loading weekly transactions...</ChartMessage>;
  } else if (failed) {
    body = <ChartMessage>Unable to load transaction data.</ChartMessage>;
  } else if (periodTotal === 0) {
    body = (
      <ChartMessage>
        No confirmed money transactions in the last {WEEKS_SHOWN} weeks.
      </ChartMessage>
    );
  } else {
    body = (
      <>
        <div className="ao-chart">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={weekly}
              margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatAxisINR}
              />
              <Tooltip
                cursor={{ opacity: 0.08 }}
                labelFormatter={(label) => `Week of ${label}`}
                formatter={(value, name) => [formatINR(value), name]}
              />
              <Legend iconType="circle" />
              <Bar
                dataKey="moneyIn"
                name="Money in (contributions + repayments)"
                fill={COLORS.primary}
                radius={[6, 6, 0, 0]}
                maxBarSize={32}
              />
              <Bar
                dataKey="moneyOut"
                name="Money out (loans given)"
                fill={COLORS.primarySoft}
                radius={[6, 6, 0, 0]}
                maxBarSize={32}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <p className="ao-chart-note">
          Money in {formatINR(periodIn)} · Money out {formatINR(periodOut)} ·
          Only confirmed transactions are counted. Weeks run Monday to Sunday.
        </p>
      </>
    );
  }

  return (
    <section className="ao-charts">
      <div className="ao-chart-card">
        <div className="ao-chart-card__header">
          <div>
            <p className="ao-chart-card__eyebrow">
              Money Transactions · Last {WEEKS_SHOWN} weeks
            </p>
            <h2>Weekly Money Flow</h2>
            <p className="ao-chart-card__sub">{scopeName}</p>
          </div>
          <div className="ao-chart-card__badge">
            <HandCoins size={16} />
            <span>{formatINR(periodTotal)} total</span>
          </div>
        </div>
        {body}
      </div>
    </section>
  );
}

function SanghaList({ sanghas, loading, failed }) {
  let body;

  if (loading) {
    body = (
      <ul className="ao-list">
        {[0, 1, 2].map((i) => (
          <li key={i} className="ao-sangha">
            <div className="ao-sangha__main">
              <span className="ao-skeleton ao-skeleton--line" />
              <span className="ao-skeleton ao-skeleton--line ao-skeleton--short" />
            </div>
            <span className="ao-skeleton ao-skeleton--line" />
          </li>
        ))}
      </ul>
    );
  } else if (failed) {
    body = <p className="ao-empty__text">Your sanghas couldn't be loaded.</p>;
  } else if (sanghas.length === 0) {
    body = (
      <div className="ao-empty">
        <div className="ao-empty__icon">
          <Building2 size={22} strokeWidth={1.8} />
        </div>
        <p className="ao-empty__title">No sanghas yet</p>
        <p className="ao-empty__text">Sanghas you manage will appear here.</p>
      </div>
    );
  } else {
    body = (
      <ul className="ao-list">
        {sanghas.map((sangha) => {
          const count = getMembersCount(sangha);
          const isFull = count >= SANGHA_CAPACITY;
          const meta = [
            sangha.code,
            sangha.subadmin_name ? `Subadmin: ${sangha.subadmin_name}` : null,
          ]
            .filter(Boolean)
            .join(" · ");

          return (
            <li key={sangha.id} className="ao-sangha">
              <div className="ao-sangha__main">
                <span className="ao-sangha__name">{sangha.name}</span>
                {meta && <span className="ao-sangha__meta">{meta}</span>}
              </div>

              <div className="ao-sangha__capacity">
                <div className="ao-sangha__count">
                  <span>
                    {count} / {SANGHA_CAPACITY} members
                  </span>
                  {isFull && <span className="ao-tag">Full</span>}
                </div>
                <ProgressBar
                  value={count}
                  max={SANGHA_CAPACITY}
                  label={`${sangha.name} membership`}
                  full={isFull}
                />
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <section className="ao-card">
      <header className="ao-card__header">
        <h2>Your Sanghas</h2>
        {!loading && !failed && (
          <span className="ao-card__count">{sanghas.length}</span>
        )}
      </header>
      {body}
    </section>
  );
}

function PendingRequestsCard({ count, loading, failed }) {
  const hasPending = count > 0;

  return (
    <section className="ao-card">
      <header className="ao-card__header">
        <h2>Pending Requests</h2>
      </header>

      {loading ? (
        <span className="ao-skeleton ao-skeleton--line" />
      ) : failed ? (
        <p className="ao-empty__text">Request status couldn't be loaded.</p>
      ) : (
        <div className="ao-pending">
          <div
            className={`ao-pending__icon ${
              hasPending ? "ao-pending__icon--attention" : ""
            }`}
          >
            {hasPending ? (
              <ClipboardList size={20} strokeWidth={2} />
            ) : (
              <Check size={20} strokeWidth={2.2} />
            )}
          </div>

          <div>
            <p className="ao-pending__title">
              {hasPending
                ? `${pluralize(count, "request")} pending`
                : "All caught up"}
            </p>
            <p className="ao-pending__text">
              {hasPending
                ? "Waiting for Super Admin review."
                : "No requests are waiting for review."}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function CapacityCard({ totalMembers, sanghaCount }) {
  const totalSeats = sanghaCount * SANGHA_CAPACITY;
  const percent = totalSeats
    ? Math.min(100, Math.round((totalMembers / totalSeats) * 100))
    : 0;

  return (
    <section className="ao-card">
      <header className="ao-card__header">
        <h2>Membership Capacity</h2>
      </header>

      <p className="ao-capacity__figure">
        <strong>{totalMembers}</strong> of {totalSeats} seats filled
      </p>

      <ProgressBar
        value={percent}
        max={100}
        label="Total membership capacity"
        large
      />

      <p className="ao-capacity__note">
        Across {pluralize(sanghaCount, "sangha")}, up to {SANGHA_CAPACITY}{" "}
        members each.
      </p>
    </section>
  );
}

function SavingsSection({ savings, loading, failed }) {
  const accounts = savings?.accounts ?? [];
  const maxBalance = Math.max(1, ...accounts.map((a) => a.balance));

  let body;
  if (loading) {
    body = <ChartMessage loading>Loading savings accounts...</ChartMessage>;
  } else if (failed) {
    body = <ChartMessage>Unable to load savings accounts.</ChartMessage>;
  } else if (accounts.length === 0) {
    body = (
      <EmptyState
        icon={PiggyBank}
        title="No savings accounts yet"
        text="Savings accounts created for your Sanghas will appear here."
      />
    );
  } else {
    body = (
      <ul className="ao-balance-list">
        {accounts.map((account) => (
          <li key={account.sanghaId} className="ao-balance-row">
            <div className="ao-balance-row__top">
              <span className="ao-balance-row__name">{account.sanghaName}</span>
              <strong>{formatINR(account.balance)}</strong>
            </div>
            <ProgressBar
              value={account.balance}
              max={maxBalance}
              label={`${account.sanghaName} balance`}
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <FeatureSection
      eyebrow="Financial Management"
      title="Savings Accounts"
      text="Current balance of each savings account under your Sanghas."
      icon={PiggyBank}
    >
      {body}
    </FeatureSection>
  );
}

function LoanRequestsSection({ data, loading, failed }) {
  const shared = { loading, failed };

  return (
    <FeatureSection
      eyebrow="Loan Management"
      title="Loan Requests"
      text="Emergency fund requests raised by members of your Sanghas."
      icon={HandCoins}
    >
      <div className="ao-feature-grid">
        <SummaryCard
          icon={HandCoins}
          title="Total Requests"
          value={data?.total ?? 0}
          description={`${formatINR(data?.totalRequestedAmount)} requested`}
          {...shared}
        />
        <SummaryCard
          icon={ClipboardList}
          title="Pending"
          value={data?.pending ?? 0}
          description="Waiting for review"
          attention={(data?.pending ?? 0) > 0}
          {...shared}
        />
        <SummaryCard
          icon={Check}
          title="Approved"
          value={data?.approved ?? 0}
          description="Approved so far"
          {...shared}
        />
        <SummaryCard
          icon={AlertCircle}
          title="Rejected"
          value={data?.rejected ?? 0}
          description="Not approved"
          {...shared}
        />
      </div>
    </FeatureSection>
  );
}

function LoanApprovalsSection({ data, loading, failed }) {
  const shared = { loading, failed };

  return (
    <FeatureSection
      eyebrow="Approval Management"
      title="Loan Approvals"
      text="Money approved, given out and paid back across your Sanghas."
      icon={BadgeCheck}
    >
      <div className="ao-feature-grid">
        <SummaryCard
          icon={BadgeCheck}
          title="Approved Amount"
          value={formatINR(data?.approvedAmount)}
          description="Total approved"
          {...shared}
        />
        <SummaryCard
          icon={HandCoins}
          title="Given Out"
          value={formatINR(data?.disbursedAmount)}
          description="Sent to members"
          {...shared}
        />
        <SummaryCard
          icon={UserCheck}
          title="Paid Back"
          value={formatINR(data?.repaidAmount)}
          description={`+ ${formatINR(data?.interestEarned)} interest`}
          {...shared}
        />
        <SummaryCard
          icon={AlertCircle}
          title="Still Outstanding"
          value={formatINR(data?.outstanding)}
          description="Yet to be repaid"
          attention={(data?.outstanding ?? 0) > 0}
          {...shared}
        />
      </div>
    </FeatureSection>
  );
}

/* =========================================================
   PAGE
========================================================= */

export default function Overview() {
  const [selectedSangha, setSelectedSangha] = useState(""); // "" = all

  const sanghasQuery = useApiData("/sanghas", (d) =>
    Array.isArray(d) ? d : [],
  );
  const pendingQuery = useApiData(
    "/admin-requests/pending-count",
    (d) => d?.pending_count ?? 0,
  );
  const financeQuery = useAdminOverview(selectedSangha);

  const sanghas = sanghasQuery.data ?? [];
  const pendingCount = pendingQuery.data ?? 0;
  const finance = financeQuery.data;

  /* ---- derived values ---- */
  const totalMembers = sanghas.reduce((sum, s) => sum + getMembersCount(s), 0);
  const totalSeats = sanghas.length * SANGHA_CAPACITY;
  const availableSeats = Math.max(totalSeats - totalMembers, 0);
  const fullSanghas = sanghas.filter(
    (s) => getMembersCount(s) >= SANGHA_CAPACITY,
  ).length;

  const weekly = finance?.weekly ?? [];
  const thisWeek = weekly[weekly.length - 1];

  const scopeName =
    sanghas.find((s) => String(s.id) === String(selectedSangha))?.name ||
    "All sanghas";

  const firstName = (getStoredUser().fullname || "").trim().split(" ")[0];

  let sanghaLine = "";
  if (!sanghasQuery.loading && !sanghasQuery.failed) {
    if (sanghas.length === 1) sanghaLine = sanghas[0].name;
    else if (sanghas.length > 1)
      sanghaLine = `Managing ${sanghas.length} sanghas`;
    else sanghaLine = "No sanghas assigned yet";
  }

  const anyFailed =
    sanghasQuery.failed || pendingQuery.failed || financeQuery.failed;

  const financeProps = {
    loading: financeQuery.loading,
    failed: financeQuery.failed,
  };

  return (
    <div className="sa-page ao-page">
      <Header
        greeting={getGreeting()}
        firstName={firstName}
        sanghaLine={sanghaLine}
      />

      {anyFailed && (
        <div className="ao-alert" role="alert">
          <AlertCircle size={16} strokeWidth={2} />
          <span>
            Some information couldn't be loaded. Refresh the page to try again.
          </span>
        </div>
      )}

      {/* Top statistics */}
      <section className="ao-stats" aria-label="Overview statistics">
        <StatTile
          icon={Building2}
          label="Sanghas Managed"
          value={sanghas.length}
          loading={sanghasQuery.loading}
          failed={sanghasQuery.failed}
        />
        <StatTile
          icon={Users}
          label="Total Members"
          value={totalMembers}
          loading={sanghasQuery.loading}
          failed={sanghasQuery.failed}
        />
        <StatTile
          icon={PiggyBank}
          label="Savings Accounts"
          value={finance?.savings?.accountsCount ?? 0}
          loading={financeQuery.loading && !finance}
          failed={financeQuery.failed}
        />
        <StatTile
          icon={ClipboardList}
          label="Pending Admin Requests"
          value={pendingCount}
          loading={pendingQuery.loading}
          failed={pendingQuery.failed}
          attention={pendingCount > 0}
        />
      </section>

      <MembershipChart
        sanghas={sanghas}
        totalMembers={totalMembers}
        loading={sanghasQuery.loading}
        failed={sanghasQuery.failed}
      />

      <SanghaFilter
        sanghas={sanghas}
        value={selectedSangha}
        onChange={setSelectedSangha}
      />

      <MoneyFlowChart weekly={weekly} scopeName={scopeName} {...financeProps} />

      {/* Summary cards */}
      <section className="ao-summary-grid">
        <SummaryCard
          icon={Users}
          title="Available Seats"
          value={availableSeats}
          description={`Across ${pluralize(sanghas.length, "sangha")}`}
          loading={sanghasQuery.loading}
          failed={sanghasQuery.failed}
        />
        <SummaryCard
          icon={Building2}
          title="Full Sanghas"
          value={fullSanghas}
          description={`${sanghas.length - fullSanghas} with available seats`}
          loading={sanghasQuery.loading}
          failed={sanghasQuery.failed}
        />
        <SummaryCard
          icon={PiggyBank}
          title="Savings Balance"
          value={formatINR(finance?.savings?.totalBalance)}
          description={scopeName}
          {...financeProps}
        />
        <SummaryCard
          icon={HandCoins}
          title="This Week's Transactions"
          value={formatINR(thisWeek?.total)}
          description={`In ${formatINR(thisWeek?.moneyIn)} · Out ${formatINR(
            thisWeek?.moneyOut,
          )}`}
          {...financeProps}
        />
      </section>

      {/* Sanghas and requests */}
      <div className="ao-grid">
        <SanghaList
          sanghas={sanghas}
          loading={sanghasQuery.loading}
          failed={sanghasQuery.failed}
        />

        <div className="ao-side">
          <PendingRequestsCard
            count={pendingCount}
            loading={pendingQuery.loading}
            failed={pendingQuery.failed}
          />

          {!sanghasQuery.loading &&
            !sanghasQuery.failed &&
            sanghas.length > 0 && (
              <CapacityCard
                totalMembers={totalMembers}
                sanghaCount={sanghas.length}
              />
            )}
        </div>
      </div>

      <SavingsSection savings={finance?.savings} {...financeProps} />
      <LoanRequestsSection data={finance?.loanRequests} {...financeProps} />
      <LoanApprovalsSection data={finance?.loanApprovals} {...financeProps} />
    </div>
  );
}