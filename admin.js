const $ = s => document.querySelector(s);
const forms = ["astrologerForm","productForm","blogForm"];
async function api(path, options={}) {
  const response = await fetch(path, { credentials:"same-origin", headers:{"Content-Type":"application/json", ...(options.headers||{})}, ...options });
  const data = await response.json().catch(()=>({error:"सर्वर से सही जवाब नहीं मिला।"}));
  if(!response.ok) throw new Error(data.error || `त्रुटि (${response.status})`);
  return data;
}
function message(el, text){ el.textContent = text; }
function showDashboard(yes){ $("#loginCard").classList.toggle("hidden",yes); $("#dashboard").classList.toggle("hidden",!yes); }
async function checkSession(){
  try { const d=await api("/api/me"); showDashboard(!!d.authenticated); if(d.authenticated) await refreshAll(); }
  catch(e){ showDashboard(false); message($("#loginStatus"),"API उपलब्ध नहीं है। पहले Cloudflare Worker सेटअप करें।"); }
}
$("#loginForm").addEventListener("submit", async e=>{
  e.preventDefault(); message($("#loginStatus"),"लॉगिन जाँचा जा रहा है…");
  try { await api("/api/login",{method:"POST",body:JSON.stringify({password:new FormData(e.currentTarget).get("password")})}); e.currentTarget.reset(); showDashboard(true); await refreshAll(); message($("#loginStatus"),"लॉगिन सफल।"); }
  catch(err){ message($("#loginStatus"),err.message); }
});
$("#logoutBtn").addEventListener("click",async()=>{try{await api("/api/logout",{method:"POST",body:"{}"});}finally{showDashboard(false);}});
function formData(form){ return Object.fromEntries(new FormData(form).entries()); }
async function addFrom(formId, endpoint){
  const form=$("#"+formId);
  form.addEventListener("submit",async e=>{
    e.preventDefault();
    try { await api(endpoint,{method:"POST",body:JSON.stringify(formData(form))}); form.reset(); message($("#dashStatus"),"सामग्री सुरक्षित रूप से सेव हो गई।"); await refreshAll(); }
    catch(err){ message($("#dashStatus"),err.message); }
  });
}
addFrom("astrologerForm","/api/astrologers");
addFrom("productForm","/api/products");
addFrom("blogForm","/api/blogs");
async function renderList(table, target, titleField){
  const items=await api("/api/"+table);
  const root=$(target);
  root.replaceChildren();
  if(!items.length){root.textContent="अभी कोई अतिरिक्त सामग्री नहीं है।";return;}
  for(const item of items){
    const div=document.createElement("div");div.className="item";
    const h=document.createElement("h3");h.textContent=item[titleField]||"(बिना शीर्षक)";div.append(h);
    const del=document.createElement("button");del.className="danger";del.textContent="हटाएँ";
    del.addEventListener("click",async()=>{if(!confirm("क्या आप इसे हटाना चाहते हैं?"))return;try{await api(`/api/${table}/${item.id}`,{method:"DELETE",body:"{}"});await refreshAll();}catch(err){message($("#dashStatus"),err.message);}});
    div.append(del);root.append(div);
  }
}
async function refreshAll(){
 await Promise.all([
  renderList("astrologers","#astrologersList","name"),
  renderList("products","#productsList","name"),
  renderList("blogs","#blogsList","title")
 ]);
}
checkSession();
