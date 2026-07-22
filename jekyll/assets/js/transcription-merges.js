(() => {
  const $ = (id) => document.getElementById(id);
  const state = { index: null, detail: null };
  const make = (tag, className, value) => { const node = document.createElement(tag); if (className) node.className = className; if (value !== undefined) node.textContent = value; return node; };
  const number = (value) => new Intl.NumberFormat().format(Number(value || 0));
  const date = (value) => value ? new Intl.DateTimeFormat(undefined, {dateStyle:'medium',timeStyle:'short'}).format(new Date(value)) : 'Unknown date';
  const category = (line) => {
    if (line.text_action === 'approved' || line.speaker_action === 'approved') return 'changes';
    if (line.text_action === 'review' || line.speaker_action === 'review') return 'review';
    if (line.match_type === 'unmatched_json' || !line.source_text) return 'unmatched';
    return 'same';
  };
  const stat = (value, label) => { const card=make('article'); card.append(make('strong','',number(value)),make('span','',label)); return card; };

  function renderLines() {
    const query=$('merge-search').value.trim().toLowerCase(), filter=$('merge-filter').value;
    const all=state.detail.alignments || [];
    const lines=all.filter((line) => (filter==='all'||category(line)===filter) && (!query || [line.target_index,line.current_speaker,line.source_speaker,line.current_text,line.source_text].some(v=>String(v??'').toLowerCase().includes(query))));
    $('merge-line-count').textContent=`${number(lines.length)} of ${number(all.length)} lines`;
    const list=$('merge-lines'); list.replaceChildren();
    if (!lines.length) { list.append(make('div','merge-empty','No lines match this view.')); return; }
    for (const line of lines) {
      const card=make('article',`merge-line is-${category(line)}`), top=make('div','merge-line-top');
      const lineCategory=category(line);
      const action=lineCategory==='review'?'review':lineCategory==='changes'?'approved':String(line.text_action||line.speaker_action||line.match_type).replaceAll('_',' ');
      top.append(make('b','',`#${line.target_index}`),make('span','',`${Math.round(Number(line.similarity||0)*100)}% similarity`),make('span','merge-badge',action));
      const body=make('div','merge-line-body');
      for (const [label,speaker,text] of [['Repository',line.current_speaker,line.current_text],['Whisper',line.source_speaker,line.source_text]]) { const pane=make('div','merge-dialogue'); pane.append(make('small','',`${label} · ${speaker||'no speaker'}`),make('p',text?'':'is-empty',text||'No aligned line')); body.append(pane); }
      card.append(top,body); list.append(card);
    }
  }

  function renderDetail() {
    const {run,speaker_mappings:mappings=[],metadata={},receipts=[]}=state.detail;
    $('merge-empty').hidden=true; $('merge-detail').hidden=false;
    $('merge-album').textContent=run.album; $('merge-track').textContent=run.track;
    $('merge-meta').textContent=`Compared ${date(run.generated_at)} · ${run.model||'unknown model'} · ${run.id}`;
    $('merge-state').textContent=run.merged?'Merged':'Review pending'; $('merge-state').className=`merge-badge ${run.merged?'is-merged':'is-pending'}`;
    $('merge-run-stats').replaceChildren(stat(run.alignment_count,'aligned lines'),stat(run.review_lines,'review lines'),stat(run.approved_lines,'approved lines'),stat(run.metadata_proposals,'metadata proposals'),stat(run.merge_count,'merge receipts'));
    $('merge-speaker-count').textContent=`${number(mappings.length)} mappings`; $('merge-speakers').replaceChildren();
    for (const item of mappings) { const chip=make('span','merge-chip'); chip.append(make('i','',item.source_speaker),make('span','', '→'),make('b','',item.proposed_speaker||'unmapped'),make('small','',`${Math.round(Number(item.confidence||0)*100)}% · ${item.action}`)); $('merge-speakers').append(chip); }
    const proposals=[...(metadata.aliases||[]).map(x=>({kind:'Alias',...x})),...(metadata.establishments||[]).map(x=>({kind:'Establishment',...x}))];
    $('merge-metadata-count').textContent=`${number(proposals.length)} proposals`; $('merge-metadata').replaceChildren();
    for (const item of proposals) $('merge-metadata').append(make('span','merge-chip',`${item.kind}: ${item.value||item.name||item.text||'proposal'} · ${item.action||'review'}`));
    $('merge-receipt-count').textContent=`${number(receipts.length)} receipts`; const receiptList=$('merge-receipts'); receiptList.replaceChildren();
    for (const receipt of receipts) { const applied=receipt.applied||{}, card=make('article','merge-receipt'); card.append(make('strong','',date(receipt.merged_at)),make('p','',`${number(applied.text_changed)} text · ${number(applied.speakers_changed)} speakers · ${number(applied.review_flags_added)} review flags`),make('small','',`Aliases: ${(applied.aliases||[]).join(', ')||'none'} · Establishments: ${(applied.establishments||[]).join(', ')||'none'}`)); receiptList.append(card); }
    if (!receipts.length) receiptList.append(make('div','merge-empty','No real merge has been recorded for this run.'));
    renderLines();
  }

  async function selectRun(id) {
    $('merge-status').textContent='Loading comparison…';
    const response=await fetch(`/api/transcription-merges?run=${encodeURIComponent(id)}`,{cache:'no-store'});
    if (!response.ok) throw new Error(`HTTP ${response.status}`); state.detail=await response.json(); renderDetail();
    $('merge-status').textContent='Archive ready · repository data remains authoritative until changes are approved.';
    const url=new URL(location.href); url.searchParams.set('run',id); history.replaceState(null,'',url);
  }

  async function start() {
    try {
      const response=await fetch('/api/transcription-merges',{cache:'no-store'}); if(!response.ok) throw new Error(`HTTP ${response.status}`); state.index=await response.json();
      const stats=state.index.stats; for (const [id,key] of [['runs','comparison_runs'],['tracks','tracks'],['review','review_lines'],['approved','approved_lines'],['merged','merged_runs'],['receipts','merge_receipts']]) $(`merge-stat-${id}`).textContent=number(stats[key]);
      const select=$('merge-run'); select.replaceChildren(); for(const run of state.index.runs){const option=make('option','',`${run.track} · ${run.album} · ${run.merged?'merged':'review pending'}`); option.value=run.id; select.append(option);}
      if(!state.index.runs.length){$('merge-detail').hidden=true;$('merge-empty').hidden=false;$('merge-status').textContent='No comparisons have been saved yet.';return;}
      const requested=new URLSearchParams(location.search).get('run'); const chosen=state.index.runs.find(run=>run.id===requested)||state.index.runs[0]; select.value=chosen.id; await selectRun(chosen.id);
      select.addEventListener('change',()=>selectRun(select.value).catch(showError)); $('merge-search').addEventListener('input',renderLines); $('merge-filter').addEventListener('change',renderLines);
    } catch(error){showError(error);}
  }
  function showError(error){console.error(error);$('merge-status').textContent='The local merge archive could not be opened.';$('merge-status').classList.add('is-error');}
  start();
})();
