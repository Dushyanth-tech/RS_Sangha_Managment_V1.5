import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, Download, FileSpreadsheet } from "lucide-react";
import api from "../api/axiosInstance";

export default function DownloadReportsButton() {
  const [open, setOpen] = useState(false);
  const [sanghas, setSanghas] = useState([]);
  const [role, setRole] = useState("");
  const [sanghaId, setSanghaId] = useState("");
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [loadingSanghas, setLoadingSanghas] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api.get("/sangha-savings/reports/sanghas")
      .then(({ data }) => {
        if (!active) return;
        const available = data.sanghas || [];
        setSanghas(available);
        setRole(data.role || "");
        if (data.role === "admin" && available.length) setSanghaId(String(available[0].id));
      })
      .catch(() => {
        if (active) setError("Unable to load your Sanghas.");
      })
      .finally(() => {
        if (active) setLoadingSanghas(false);
      });
    return () => { active = false; };
  }, []);

  const selectedSanghaName = useMemo(
    () => sanghas.find((sangha) => String(sangha.id) === sanghaId)?.name,
    [sanghas, sanghaId],
  );

  const download = async () => {
    if (downloading || loadingSanghas) return;
    if (!sanghaId) {
      setError("Please select a Sangha before downloading the report.");
      return;
    }
    if (!month) {
      setError("Please select a month and year.");
      return;
    }
    setDownloading(true);
    setError("");
    try {
      const response = await api.get("/sangha-savings/reports/members.xlsx", {
        responseType: "blob",
        params: {
          month,
          ...(sanghaId ? { sangha_id: Number(sanghaId) } : {}),
        },
      });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      const safeSanghaName = (selectedSanghaName || "Sangha")
        .replace(/[^a-z0-9_-]+/gi, "_")
        .replace(/^[_-]+|[_-]+$/g, "") || "Sangha";
      const [year, monthNumber] = month.split("-");
      const monthName = new Intl.DateTimeFormat("en", { month: "long" }).format(
        new Date(Number(year), Number(monthNumber) - 1, 1),
      );
      link.download = `${safeSanghaName}_${monthName}_${year}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (downloadError) {
      let message = "Report download failed. Try again.";
      try {
        const body = downloadError?.response?.data;
        const parsed = body instanceof Blob ? JSON.parse(await body.text()) : body;
        message = parsed?.detail || message;
      } catch { /* keep fallback */ }
      setError(message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="tb__report-wrap">
      <button
        type="button"
        className="tb__reports"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Choose Sangha and month for report"
      >
        <FileSpreadsheet size={17} />
        <span>Download Report</span>
        <ChevronDown size={15} />
      </button>
      {open && (
        <div className="tb__report-menu" role="dialog" aria-label="Download Sangha report">
          <label>
            Sangha
            <select
              value={sanghaId}
              onChange={(event) => setSanghaId(event.target.value)}
              disabled={loadingSanghas || downloading}
            >
              <option value="">{sanghas.length ? "Select a Sangha" : "No assigned Sangha"}</option>
              {sanghas.map((sangha) => (
                <option key={sangha.id} value={sangha.id}>{sangha.name}</option>
              ))}
            </select>
          </label>
          <label>
            Month
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} disabled={downloading} />
          </label>
          <button
            type="button"
            className="tb__report-download"
            onClick={download}
            disabled={loadingSanghas || downloading || !month || sanghas.length === 0}
          >
            <Download size={16} />
            {loadingSanghas ? "Loading Sanghas…" : downloading ? "Preparing report…" : "Download Report"}
          </button>
          {error && <span className="tb__report-error" role="alert">{error}</span>}
        </div>
      )}
    </div>
  );
}
