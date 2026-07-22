(() => {
  const byId = (id) => document.getElementById(id);
  const text = (id, value) => { byId(id).textContent = value; };
  const formatDate = (value) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium" }).format(new Date(value)) : "—";
  const formatDuration = (startedAt, completedAt) => {
    if (!startedAt) return null;
    const elapsed = Math.max(0, new Date(completedAt || Date.now()).getTime() - new Date(startedAt).getTime());
    const totalSeconds = Math.floor(elapsed / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };
  const render = ({ whisper, batch }) => {
    const dot = byId("connection-dot");
    dot.className = `status-dot ${whisper.online && whisper.transcription_api ? "online" : "offline"}`;
    text("connection-label", whisper.online ? "Whisper is online" : "Whisper is offline");
    text("connection-detail", whisper.online ? "Local API connected" : "Waiting for the local app");
    if (!batch) return;
    const totals = batch.totals || {};
    const complete = totals.completed || 0;
    const all = totals.all || 0;
    const percent = all ? Math.round((complete / all) * 100) : 0;
    text("album-title", batch.album?.title || "Transcription batch");
    text("model-name", batch.model || "—");
    text("batch-state", String(batch.status || "waiting").replaceAll("_", " "));
    text("last-updated", `Updated ${formatDate(batch.updated_at)}`);
    text("progress-count", `${complete} of ${all} complete`);
    text("progress-percent", `${percent}%`);
    byId("progress-bar").style.width = `${percent}%`;
    byId("progress-bar").parentElement.setAttribute("aria-valuenow", String(percent));
    const activeTrack = (batch.tracks || []).find((track) => track.status === "running");
    const activeDuration = activeTrack && formatDuration(activeTrack.started_at);
    text("current-track", batch.current_track ? `Now analyzing: ${batch.current_track.number}. ${batch.current_track.title}${activeDuration ? ` · Running for ${activeDuration}` : ""}` : (batch.status?.startsWith("completed") ? "Batch finished." : "Preparing the next track…"));
    for (const name of ["completed", "running", "pending", "failed"]) text(`total-${name}`, totals[name] || 0);
    const list = byId("track-list");
    list.replaceChildren();
    for (const track of batch.tracks || []) {
      const row = document.createElement("li");
      const number = document.createElement("span"); number.className = "track-number"; number.textContent = String(track.number).padStart(2, "0");
      const title = document.createElement("span"); title.className = "track-title"; title.textContent = track.title;
      const meta = document.createElement("span");
      meta.className = "track-meta";
      const duration = formatDuration(track.started_at, track.completed_at);
      if (track.completed_at) meta.textContent = `${duration ? `Took ${duration} · ` : ""}Finished ${formatDate(track.completed_at)}`;
      else if (track.status === "running" && duration) meta.textContent = `Running for ${duration}`;
      else meta.textContent = track.status === "pending" ? "Waiting" : "";
      const state = document.createElement("span"); state.className = `track-state ${track.status}`; state.textContent = track.status === "failed" ? "Needs attention" : track.status;
      row.append(number, title, meta, state); list.append(row);
    }
  };
  const refresh = async () => {
    try {
      const response = await fetch("/api/transcriptions", { cache: "no-store" });
      if (!response.ok) throw new Error(`Status request failed (${response.status})`);
      render(await response.json());
    } catch (error) {
      byId("connection-dot").className = "status-dot offline";
      text("connection-label", "Monitor is unavailable");
      text("connection-detail", error.message);
    }
  };
  byId("refresh-status").addEventListener("click", refresh);
  refresh();
  setInterval(refresh, 5000);
})();
