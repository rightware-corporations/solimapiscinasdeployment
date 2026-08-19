(() => {
  "use strict";
  const card = document.querySelector(".orcamento-form-card");
  if (!card) return;
  const startedAt = Date.now();
  const labels = { NEW_CONSTRUCTION:"Construção nova", MODERNIZATION:"Modernização / reabilitação", MAINTENANCE:"Manutenção", LED:"Iluminação LED", DECK:"Deck", AUTOMATION:"Automação", HEATING:"Aquecimento", INFINITY_EDGE:"Borda infinita", EQUIPMENT:"Equipamentos", WATER_TREATMENT:"Tratamento de água", UNSURE:"Quero aconselhamento" };
  const state = { step:1, files:{ locationPhotos:[], inspirationPhotos:[] }, idempotencyKey:crypto.randomUUID(), busy:false, lastFocus:null };
  card.innerHTML = `
    <div class="form-progress" aria-label="Progresso: passo 1 de 3"><div class="form-progress-fill"></div>${[1,2,3].map(n=>`<div class="form-step-dot ${n===1?"is-current":""}" data-step-dot="${n}">${n}</div>`).join("")}</div>
    <form id="orcamentoForm" novalidate>
      <section class="form-step is-current" data-step="1"><div class="form-step-eyebrow">Passo 01 · Contacto</div><h3 class="form-step-title" tabindex="-1">Conte-nos como o contactar</h3>
        <div class="field-grid">
          <div class="form-field"><label for="customerName">Nome completo *</label><input id="customerName" name="customerName" autocomplete="name" maxlength="100" required aria-describedby="customerName-error"><p id="customerName-error" class="field-error"></p></div>
          <div class="form-field"><label for="phone">Telefone / WhatsApp *</label><input id="phone" name="phone" autocomplete="tel" inputmode="tel" maxlength="30" required aria-describedby="phone-error"><p id="phone-error" class="field-error"></p></div>
          <div class="form-field field-wide"><label for="location">Localização do projecto *</label><input id="location" name="location" autocomplete="street-address" maxlength="180" required aria-describedby="location-error"><p id="location-error" class="field-error"></p></div>
        </div>
      </section>
      <section class="form-step" data-step="2" hidden><div class="form-step-eyebrow">Passo 02 · Serviço</div><h3 class="form-step-title" tabindex="-1">O que precisa?</h3>
        <fieldset><legend class="group-label">Serviço principal *</legend><div class="choice-grid services">
          ${[["NEW_CONSTRUCTION","Construção nova","Piscina nova, do projecto ao acabamento."],["MODERNIZATION","Modernização","Reabilitação, eficiência e acabamento."],["MAINTENANCE","Manutenção","Água, química e equipamentos."]].map(([v,t,d])=>`<label class="choice-card"><input type="radio" name="serviceType" value="${v}"><span class="choice-check"></span><span class="choice-copy"><strong>${t}</strong><span>${d}</span></span></label>`).join("")}
        </div><p id="serviceType-error" class="field-error"></p></fieldset>
        <fieldset><legend class="group-label">Complementos opcionais</legend><div class="chips">${Object.entries(labels).slice(3).map(([v,t])=>`<label class="chip"><input type="checkbox" name="extras" value="${v}"><span class="choice-check"></span><span>${t}</span></label>`).join("")}</div></fieldset>
      </section>
      <section class="form-step" data-step="3" hidden><div class="form-step-eyebrow">Passo 03 · Fotografias & contexto</div><h3 class="form-step-title" tabindex="-1">Mostre-nos o local</h3>
        <div class="upload-grid">
          ${upload("locationPhotos","Fotos do local","Recomendado · até 5 imagens · 5 MB cada",5)}
          ${upload("inspirationPhotos","Fotos de inspiração","Opcional · até 2 referências · 5 MB cada",2)}
        </div>
        <p class="form-note">JPG, PNG ou WebP. As imagens são processadas para a equipa SOLIMA analisar o seu pedido.</p>
        <div class="form-field"><label for="notes">Observações (opcional)</label><textarea id="notes" name="notes" maxlength="1000"></textarea></div>
        <div class="summary" aria-label="Resumo do pedido"></div>
        <label class="consent"><span class="consent-control"><input type="checkbox" name="consentGiven" required><span class="consent-box" aria-hidden="true"></span></span><span class="consent-copy">Autorizo a SOLIMA a usar estes dados e fotografias para analisar e responder ao meu pedido. Consulte a <a href="/privacy.html">política de privacidade</a>.</span></label><p id="consentGiven-error" class="field-error"></p>
      </section>
      <input class="form-trap" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
      <div class="form-actions"><button class="btn btn-outline form-prev" type="button" hidden>Voltar</button><button class="btn btn-primary form-next" type="button">Continuar</button><button class="btn btn-primary form-submit" type="submit" hidden>Enviar pedido</button></div>
      <div class="form-status" aria-live="polite"></div>
    </form>
    <dialog class="success-dialog" aria-labelledby="success-title"><div class="dialog-inner"><div class="form-step-eyebrow">SOLIMA · Pedido registado</div><h3 id="success-title" class="form-step-title">Pedido recebido</h3><p>Recebemos os seus dados e fotografias.</p><p>A equipa SOLIMA entrará em contacto consigo brevemente.</p><div class="dialog-actions"><button type="button" class="close-dialog">Fechar</button></div></div></dialog>`;
  function upload(name,title,copy,max){return `<div class="upload-card" data-upload="${name}" data-max="${max}"><h4>${title}</h4><p>${copy}</p><label class="upload-picker">Escolher imagens<input type="file" name="${name}" accept="image/jpeg,image/png,image/webp" multiple></label><div class="preview-list"></div><p class="field-error" data-upload-error></p></div>`}
  const form = card.querySelector("form"), status = card.querySelector(".form-status"), dialog = card.querySelector("dialog");
  const value = (name) => form.elements[name]?.value?.trim() || "";
  const setError = (name,msg="") => { const input=form.elements[name]; const el=card.querySelector(`#${name}-error`); if(el)el.textContent=msg; if(input)input.setAttribute("aria-invalid",msg?"true":"false"); return !msg };
  function validate(step){
    let ok=true;
    if(step===1){ok=setError("customerName",value("customerName").length<2?"Introduza o seu nome completo.":"")&&ok;ok=setError("phone",value("phone").replace(/\D/g,"").length<8?"Introduza um telefone válido.":"")&&ok;ok=setError("location",value("location").length<3?"Indique a localização do projecto.":"")&&ok}
    if(step===2){const chosen=form.querySelector("[name=serviceType]:checked");card.querySelector("#serviceType-error").textContent=chosen?"":"Escolha o serviço principal.";ok=!!chosen}
    if(step===3){ok=setError("consentGiven",form.elements.consentGiven.checked?"":"Confirme a autorização para enviar o pedido.")&&ok}
    if(!ok) form.querySelector('[aria-invalid="true"], input:invalid')?.focus(); return ok;
  }
  function renderStep(next, focus=true){
    state.step=next;
    card.querySelectorAll(".form-step").forEach((el)=>{const active=Number(el.dataset.step)===next;el.hidden=!active;el.classList.toggle("is-current",active);if(active){el.classList.remove("is-entering");requestAnimationFrame(()=>el.classList.add("is-entering"))}});
    card.querySelectorAll("[data-step-dot]").forEach((el)=>{const n=Number(el.dataset.stepDot);el.classList.toggle("is-current",n===next);el.classList.toggle("is-done",n<next)});
    card.style.setProperty("--progress-scale",(next-1)/2);card.querySelector(".form-progress").setAttribute("aria-label",`Progresso: passo ${next} de 3`);
    card.querySelector(".form-prev").hidden=next===1;card.querySelector(".form-next").hidden=next===3;card.querySelector(".form-submit").hidden=next!==3;
    if(next===3) updateSummary();
    const rect=card.getBoundingClientRect();if(focus&&(rect.top<varNav()||rect.top>innerHeight*.75))card.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"start"});
    if(focus) card.querySelector(`.form-step[data-step="${next}"] .form-step-title`)?.focus({preventScroll:true});
  }
  const varNav=()=>parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nav-h"))||88;
  card.querySelector(".form-next").onclick=()=>{if(validate(state.step))renderStep(state.step+1)};
  card.querySelector(".form-prev").onclick=()=>renderStep(state.step-1);
  card.querySelectorAll(".upload-card").forEach((zone)=>{
    const input=zone.querySelector("input"),name=zone.dataset.upload,max=Number(zone.dataset.max);
    input.addEventListener("change",()=>addFiles(name,[...input.files],max,zone));
    ["dragenter","dragover"].forEach(e=>zone.addEventListener(e,(ev)=>{ev.preventDefault();zone.classList.add("is-dragover")}));
    ["dragleave","drop"].forEach(e=>zone.addEventListener(e,(ev)=>{ev.preventDefault();zone.classList.remove("is-dragover");if(e==="drop")addFiles(name,[...ev.dataTransfer.files],max,zone)}));
  });
  function addFiles(name,files,max,zone){
    const errors=[];for(const file of files){if(state.files[name].length>=max){errors.push(`Máximo de ${max} imagens.`);break}if(file.size>5*1024*1024){errors.push(`${file.name}: excede 5 MB.`);continue}if(!/^image\/(jpeg|png|webp)$/.test(file.type)){errors.push(`${file.name}: formato não suportado.`);continue}state.files[name].push(file)}
    zone.querySelector("[data-upload-error]").textContent=errors.join(" ");renderPreviews(name,zone);
  }
  function renderPreviews(name,zone){const list=zone.querySelector(".preview-list");list.replaceChildren(...state.files[name].map((file,index)=>{const row=document.createElement("div");row.className="preview";const img=document.createElement("img");img.alt="Pré-visualização";img.src=URL.createObjectURL(file);const info=document.createElement("div");const n=document.createElement("div");n.className="preview-name";n.textContent=file.name;const s=document.createElement("div");s.className="preview-size";s.textContent=`${(file.size/1048576).toFixed(1)} MB`;info.append(n,s);const remove=document.createElement("button");remove.type="button";remove.setAttribute("aria-label",`Remover ${file.name}`);remove.textContent="×";remove.onclick=()=>{URL.revokeObjectURL(img.src);state.files[name].splice(index,1);renderPreviews(name,zone)};row.append(img,info,remove);return row}))}
  function updateSummary(){const service=form.querySelector("[name=serviceType]:checked")?.value;const extras=[...form.querySelectorAll("[name=extras]:checked")].map(i=>labels[i.value]);const rows=[["Nome",value("customerName")],["Contacto",value("phone")],["Localização",value("location")],["Serviço",labels[service]||"—"],["Complementos",extras.join(", ")||"Nenhum"],["Fotografias",`${state.files.locationPhotos.length} do local · ${state.files.inspirationPhotos.length} inspiração`]];const summary=card.querySelector(".summary");summary.replaceChildren(...rows.map(([a,b])=>{const r=document.createElement("div");r.className="summary-row";const x=document.createElement("span");x.className="summary-label";x.textContent=a;const y=document.createElement("span");y.className="summary-value";y.textContent=b;r.append(x,y);return r}))}
  form.addEventListener("submit",async(e)=>{e.preventDefault();if(state.busy||!validate(3))return;state.busy=true;const submit=card.querySelector(".form-submit");submit.disabled=true;status.textContent="A validar…";const data=new FormData();["customerName","phone","location","serviceType","notes","website"].forEach(n=>data.append(n,value(n)));data.append("extras",JSON.stringify([...form.querySelectorAll("[name=extras]:checked")].map(i=>i.value)));data.append("consentGiven","true");data.append("startedAt",String(startedAt));Object.entries(state.files).forEach(([name,files])=>files.forEach(file=>data.append(name,file,file.name)));
    try{status.textContent="A enviar imagens e a registar o pedido…";const res=await fetch("/api/leads",{method:"POST",headers:{"Idempotency-Key":state.idempotencyKey},body:data});const body=await res.json().catch(()=>({}));if(!res.ok)throw new Error(body.error||"Não foi possível concluir o pedido.");showSuccess()}
    catch(error){status.textContent=error.message+" Pode tentar novamente.";submit.disabled=false;state.busy=false}
  });
  function showSuccess(){status.textContent="Pedido recebido.";state.lastFocus=document.activeElement;dialog.showModal();dialog.querySelector(".close-dialog").focus()}
  const close=()=>{dialog.close();state.lastFocus?.focus()};dialog.querySelector(".close-dialog").onclick=close;dialog.addEventListener("cancel",(e)=>{e.preventDefault();close()});dialog.addEventListener("click",(e)=>{if(e.target===dialog)close()});
  renderStep(1,false);
})();
