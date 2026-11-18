/**
 * SanghaInfoModal
 *
 * Read-only popup with the complete information about one Sangha:
 * name, created date, bank balance, member count and every member's
 * photo, phone, address, joined date and money received from the Sangha.
 *
 * Data: GET /admin/sanghas/{id}/details
 *       GET /admin/sanghas/{id}/members/{memberId}/photo   (image blob)
 */

import React, { useEffect, useState } from "react";
import {
  Banknote,
  Building2,
  CalendarDays,
  HandCoins,
  MapPin,
  Phone,
  UserRound,
  Users,
  X,
} from "lucide-react";

import api from "../../../../api/axiosInstance";
import "./SanghaInfoModal.css";

/* =========================================================
   HELPERS
========================================================= */

const NOT_RECORDED = "Not recorded";

const formatINR = (amount) =>
  `₹${Number(amount || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;

const formatDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : NOT_RECORDED;

const initialsOf = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "?";

/* =========================================================
   SMALL COMPONENTS
========================================================= */

function MemberAvatar({ sanghaId, member }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    if (!member.hasPhoto) return undefined;

    let cancelled = false;
    let objectUrl = null;

    api
      .get(`/admin/sanghas/${sanghaId}/members/${member.id}/photo`, {
        responseType: "blob",
      })
      .then((res) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(res.data);
        setSrc(objectUrl);
      })
      .catch(() => {
        // No photo or fetch failed: the initials avatar stays.
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [sanghaId, member.id, member.hasPhoto]);

  return src ? (
    <img className="si-avatar" src={src} alt={`${member.name}`} />
  ) : (
    <div className="si-avatar si-avatar--initials" aria-hidden="true">
      {initialsOf(member.name)}
    </div>
  );
}

function InfoItem({ icon: Icon, label, value, hint }) {
  return (
    <div className="si-info">
      <div className="si-info__icon">
        <Icon size={18} strokeWidth={2} />
      </div>
      <div className="si-info__text">
        <span className="si-info__label">{label}</span>
        <strong className="si-info__value">{value}</strong>
        {hint && <span className="si-info__hint">{hint}</span>}
      </div>
    </div>
  );
}

function MemberRow({ sanghaId, member }) {
  return (
    <li className="si-member">
      <div className="si-member__who">
        <MemberAvatar sanghaId={sanghaId} member={member} />
        <div className="si-member__name">
          <strong>{member.name}</strong>
          {member.isSubadmin && <span className="si-tag">Subadmin</span>}
        </div>
      </div>

      <div className="si-member__field">
        <span className="si-member__label">
          <Phone size={13} /> Phone
        </span>
        <span>{member.phone || "—"}</span>
      </div>

      <div className="si-member__field si-member__field--wide">
        <span className="si-member__label">
          <MapPin size={13} /> Address
        </span>
        <span>{member.address || "—"}</span>
      </div>

      <div className="si-member__field">
        <span className="si-member__label">
          <CalendarDays size={13} /> Joined
        </span>
        <span className={member.joinedAt ? "" : "si-muted"}>
          {formatDate(member.joinedAt)}
        </span>
      </div>

      <div className="si-member__field">
        <span className="si-member__label">
          <HandCoins size={13} /> Received from Sangha
        </span>
        <span>
          <strong>{formatINR(member.receivedFromSangha)}</strong>
          {member.loansTaken > 0 && (
            <span className="si-muted">
              {" "}
              · {member.loansTaken} loan{member.loansTaken === 1 ? "" : "s"}
            </span>
          )}
        </span>
        {member.outstanding > 0 && (
          <span className="si-due">Still to repay {formatINR(member.outstanding)}</span>
        )}
      </div>
    </li>
  );
}

/* =========================================================
   MODAL
========================================================= */

export default function SanghaInfoModal({ sangha, onClose }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    api
      .get(`/admin/sanghas/${sangha.id}/details`)
      .then((res) => {
        if (!cancelled) setDetails(res.data);
      })
      .catch((err) => {
        if (!cancelled)
          setError(
            err.response?.data?.detail || "Couldn't load the Sangha details."
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sangha.id]);

  // Close with the Escape key
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const info = details?.sangha;
  const bank = details?.bank;
  const members = details?.members ?? [];

  const location = info
    ? [info.address, info.city, info.state].filter(Boolean).join(", ")
    : "";

  return (
    <div
      className="si-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="si-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="si-title"
      >
        {/* Header */}
        <header className="si-header">
          <div className="si-header__icon">
            <Building2 size={22} strokeWidth={2} />
          </div>
          <div className="si-header__text">
            <h3 id="si-title">{info?.name || sangha.name}</h3>
            <p>
              {info?.code || sangha.code}
              {info && (
                <span
                  className={`si-status ${
                    info.isActive ? "si-status--on" : "si-status--off"
                  }`}
                >
                  {info.isActive ? "Active" : "Inactive"}
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            className="si-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </header>

        {/* Body */}
        <div className="si-body">
          {loading ? (
            <p className="si-state">Loading Sangha details...</p>
          ) : error ? (
            <p className="si-state si-state--error" role="alert">
              {error}
            </p>
          ) : (
            <>
              <section className="si-grid" aria-label="Sangha summary">
                <InfoItem
                  icon={CalendarDays}
                  label="Created on"
                  value={formatDate(info.createdAt)}
                />
                <InfoItem
                  icon={Banknote}
                  label="Sangha bank balance"
                  value={bank ? formatINR(bank.balance) : "No account yet"}
                  hint={bank ? `${bank.bankName} · ${bank.status}` : undefined}
                />
                <InfoItem
                  icon={Users}
                  label="Members"
                  value={`${info.membersCount} / ${info.capacity}`}
                  hint={`${Math.max(info.capacity - info.membersCount, 0)} seats available`}
                />
                <InfoItem
                  icon={HandCoins}
                  label="Given to members"
                  value={formatINR(details.totals.receivedFromSangha)}
                  hint={`${formatINR(details.totals.outstanding)} still to be repaid`}
                />
                <InfoItem
                  icon={UserRound}
                  label="Admin"
                  value={info.adminName || "—"}
                  hint={info.subadminName ? `Subadmin: ${info.subadminName}` : undefined}
                />
                <InfoItem icon={MapPin} label="Location" value={location || "—"} />
              </section>

              <section aria-label="Sangha members">
                <div className="si-section-title">
                  <h4>Members</h4>
                  <span className="si-count">{members.length}</span>
                </div>

                {members.length === 0 ? (
                  <p className="si-state">No members in this Sangha yet.</p>
                ) : (
                  <ul className="si-members">
                    {members.map((m) => (
                      <MemberRow key={m.id} sanghaId={sangha.id} member={m} />
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}