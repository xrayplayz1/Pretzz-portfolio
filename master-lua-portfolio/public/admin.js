const $ = (selector, scope=document) => scope.querySelector(selector);
const $$ = (selector, scope=document) => [...scope.querySelectorAll(selector)];
const node = (tag, cls='', content) => {
  const element=document.createElement(tag);
  if(cls)element.className=cls;
  if(content!==undefined)element.textContent=String(content);
  return element;
};
const app = {site:null,csrf:'',dirty:false,loading:false,tab:'overview'};
let toastTimeout;
function toast(message,error=false){
  const t=$('#toast');t.textContent=message;t.classList.toggle('error',error);t.hidden=false;
  clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>t.hidden=true,3600);
}
function markDirty(){app.dirty=true;const status=$('#save-state');status.textContent='Unsaved changes';status.classList.add('unsaved');}
function markSaved(){app.dirty=false;const status=$('#save-state');status.textContent='All changes saved';status.classList.remove('unsaved');}
async function api(url,options={}){
  const response=await fetch(url,{credentials:'same-origin',...options,headers:{...(options.body && !(options.body instanceof Blob)?{'Content-Type':'application/json'}:{}),...(app.csrf?{'X-CSRF-Token':app.csrf}:{}),...options.headers}});
  let data;try{data=await response.json();}catch{throw Error('Server returned an unexpected response.');}
  if(!response.ok)throw Error(data.error||`Request failed (${response.status}).`);
  return data;
}
function currentView(authenticated){$('#login-view').hidden=authenticated;$('#dashboard-view').hidden=!authenticated;}
function showTab(tab){
  if(!$('#tab-'+tab))return;
  app.tab=tab;
  $$('.tab-panel').forEach(p=>p.hidden=p.id!=='tab-'+tab);
  $$('button[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  const title={overview:'Overview',content:'Site content',projects:'Projects',expertise:'Skills & services',links:'Links & contact',security:'Security'};
  $('#page-crumb').textContent=title[tab]||tab;
  $('#sidebar').classList.remove('open');
  window.scrollTo({top:0,behavior:'smooth'});
}
function field(label,value,onChange,tag='input',opts={}){
  const outer=node('label','dynamic-field');
  outer.append(node('span','',label));
  const control=node(tag);
  if(tag==='textarea'){control.rows=opts.rows||2;}else{control.type=opts.type||'text';}
  control.value=value??'';
  if(opts.placeholder)control.placeholder=opts.placeholder;
  control.addEventListener('input',e=>{onChange(e.target.value);markDirty();});
  outer.append(control);
  return outer;
}
function iconButton(content,title,fn,danger=false){
  const btn=node('button','icon-button'+(danger?' danger':''),content);
  btn.type='button';btn.title=title;btn.setAttribute('aria-label',title);
  btn.addEventListener('click',fn);return btn;
}
function actionHeader(title,index,list,render){
  const header=node('div','dynamic-row-header');
  header.append(node('strong','',title));
  const actions=node('div','dynamic-actions');
  if(index>0)actions.append(iconButton('↑','Move up',()=>{[list[index-1],list[index]]=[list[index],list[index-1]];render();markDirty();}));
  if(index<list.length-1)actions.append(iconButton('↓','Move down',()=>{[list[index+1],list[index]]=[list[index],list[index+1]];render();markDirty();}));
  actions.append(iconButton('×','Remove',()=>{list.splice(index,1);render();markDirty();},true));
  header.append(actions);return header;
}
function buildStatEditor(){
  const holder=$('#stats-editor');holder.replaceChildren();
  app.site.stats.forEach((stat,index)=>{
    const wrap=node('div','dynamic-row');wrap.append(actionHeader('STAT '+(index+1),index,app.site.stats,buildStatEditor));
    const fields=node('div','fields two-col');
    fields.append(field('Value',stat.value,v=>stat.value=v),field('Description',stat.label,v=>stat.label=v));
    wrap.append(fields);holder.append(wrap);
  });
}
function buildServices(){
  const holder=$('#services-editor');holder.replaceChildren();
  app.site.services.forEach((service,index)=>{
    const wrap=node('div','dynamic-row');wrap.append(actionHeader(`SERVICE ${index+1}`,index,app.site.services,buildServices));
    const fields=node('div','fields');const pair=node('div','fields two-col');
    pair.append(field('Number',service.number,v=>service.number=v),field('Service title',service.title,v=>service.title=v));
    fields.append(pair,field('Description',service.description,v=>service.description=v,'textarea',{rows:3}));
    wrap.append(fields);holder.append(wrap);
  });
}
function buildSocials(){
  const holder=$('#socials-editor');holder.replaceChildren();
  app.site.socials.forEach((social,index)=>{
    const wrap=node('div','dynamic-row');wrap.append(actionHeader(`LINK ${index+1}`,index,app.site.socials,buildSocials));
    const fields=node('div','fields two-col');
    fields.append(field('Platform name',social.name,v=>social.name=v),field('Full URL',social.url,v=>social.url=v,'input',{placeholder:'https://...'}));
    wrap.append(fields);holder.append(wrap);
  });
}
function makeProjectField(project,name,label,tag='input',options={}){
  return field(label,project[name],v=>{
    project[name]=v;
    if(name==='title'){
      const heading=$(`[data-project-heading="${project.id}"]`);
      if(heading)heading.textContent=v||'Untitled project';
    }
  },tag,options);
}
function buildProjects(){
  const list=$('#projects-editor');list.replaceChildren();
  if(!app.site.projects.length){const blank=node('div','panel');blank.append(node('p','',"No projects yet. Add your first one to begin."));list.append(blank);}
  app.site.projects.forEach((project,index)=>{
    const card=node('article','project-edit-card');
    const coverCol=node('div');
    const preview=node('div','project-cover');
    const image=node('img');
    image.alt=project.title+' cover';
    if(project.image){image.src=project.image;preview.append(image);}else{preview.append(node('span','empty-cover','NO COVER IMAGE'));}
    const uploadWrap=node('div','cover-tools');
    const uploadLabel=node('label','upload-btn','↑ UPLOAD COVER');
    const uploadInput=node('input');uploadInput.type='file';uploadInput.accept='image/png,image/jpeg,image/webp,image/gif,image/avif';
    uploadLabel.append(uploadInput);
    uploadInput.addEventListener('change',async()=>{
      const file=uploadInput.files?.[0];if(!file)return;
      if(file.size>5_000_000){toast('Image must be smaller than 5 MB.',true);return;}
      uploadLabel.textContent='UPLOADING...';
      try{
        const result=await api('/api/admin/upload',{method:'POST',body:file,headers:{'Content-Type':file.type}});
        project.image=result.url;markDirty();buildProjects();toast('Image uploaded. Save changes to publish.');
      }catch(error){toast(error.message,true);buildProjects();}
    });
    uploadWrap.append(uploadLabel,node('div','upload-helper','PNG / JPG / WEBP / GIF / AVIF — MAX 5MB'));
    coverCol.append(preview,uploadWrap);
    const form=node('div','project-fields');
    const heading=node('div','project-edit-head');
    const h=node('strong','',project.title||'Untitled project');h.dataset.projectHeading=project.id;
    heading.append(h);
    const actions=node('div','dynamic-actions');
    if(index>0)actions.append(iconButton('↑','Move project up',()=>{[app.site.projects[index-1],app.site.projects[index]]=[app.site.projects[index],app.site.projects[index-1]];buildProjects();markDirty();}));
    if(index<app.site.projects.length-1)actions.append(iconButton('↓','Move project down',()=>{[app.site.projects[index+1],app.site.projects[index]]=[app.site.projects[index],app.site.projects[index+1]];buildProjects();markDirty();}));
    actions.append(iconButton('×','Delete project',()=>{
      if(!window.confirm(`Delete project "${project.title}"?`))return;
      app.site.projects.splice(index,1);buildProjects();markDirty();
    },true));
    heading.append(actions);
    const fields=node('div','project-edit-fields');
    const pair=node('div','two');pair.append(makeProjectField(project,'title','Project name'),makeProjectField(project,'category','Category / tag'));fields.append(pair);
    fields.append(makeProjectField(project,'description','Description','textarea'));
    const trio=node('div','three');trio.append(makeProjectField(project,'year','Year'),makeProjectField(project,'art','Fallback color (snow / pink / blue / neon / orange / green)'),makeProjectField(project,'image','Image URL or uploaded path'));
    fields.append(trio);
    const links=node('div','project-links');links.append(makeProjectField(project,'url','Project / experience link'),makeProjectField(project,'github','Code / repository link'));fields.append(links);
    const check=node('label','check-line');
    const checkbox=node('input');checkbox.type='checkbox';checkbox.checked=Boolean(project.featured);
    checkbox.addEventListener('change',()=>{project.featured=checkbox.checked;markDirty();});
    check.append(checkbox,node('span','','Mark as featured'));fields.append(check);
    form.append(heading,fields);
    card.append(coverCol,form);list.append(card);
  });
}
function populateOverview(){
  const values=[{icon:'◈',value:app.site.projects.length,label:'PROJECTS IN PORTFOLIO'},{icon:'✳',value:app.site.skills.length,label:'SKILLS LISTED'},{icon:'↗',value:app.site.socials.filter(s=>s.url).length,label:'LINKED PROFILES'}];
  const box=$('#metrics');box.replaceChildren();
  values.forEach(x=>{
    const card=node('div','metric');card.append(node('span','metric-icon',x.icon),node('div','metric-value',x.value),node('span','metric-label',x.label));box.append(card);
  });
}
function populate(){
  $$('[data-field]').forEach(input=>{
    const key=input.dataset.field;input.value=app.site[key]??'';
    input.oninput=()=>{app.site[key]=input.value;markDirty();if(key==='accent'){$('#color-hex').textContent=input.value;document.documentElement.style.setProperty('--accent',input.value);}};
  });
  $('#color-hex').textContent=app.site.accent;
  document.documentElement.style.setProperty('--accent',app.site.accent);
  $('#skills-input').value=app.site.skills.join('\n');
  $('#skills-input').oninput=event=>{app.site.skills=event.target.value.split(/[,\n]/).map(x=>x.trim()).filter(Boolean);markDirty();};
  populateOverview();buildProjects();buildStatEditor();buildServices();buildSocials();
}
async function loadDashboard(){
  const result=await api('/api/site');app.site=result;
  populate();markSaved();currentView(true);showTab('overview');
}
async function save(){
  if(app.loading || !app.site)return;
  app.loading=true;const btn=$('#save-main');btn.disabled=true;btn.textContent='SAVING...';
  try{
    const res=await api('/api/admin/site',{method:'PUT',body:JSON.stringify(app.site)});
    app.site=res.site;populate();markSaved();toast('Your portfolio is updated!');
  }catch(error){toast(error.message,true);}finally{app.loading=false;btn.disabled=false;btn.textContent='SAVE CHANGES ↗';}
}
$('#save-main').addEventListener('click',save);
$('#login-form').addEventListener('submit',async event=>{
  event.preventDefault();$('#login-error').textContent='';
  const btn=$('#login-submit');btn.disabled=true;
  try{
    const login=await api('/api/admin/login',{method:'POST',body:JSON.stringify({password:$('#password').value})});
    app.csrf=login.csrf;$('#password').value='';await loadDashboard();
  }catch(error){$('#login-error').textContent=error.message;}finally{btn.disabled=false;}
});
$$('button[data-tab]').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.tab)));
$$('button[data-jump]').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.jump)));
$('#sidebar-toggle').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
$('#add-project').addEventListener('click',()=>{
  if(app.site.projects.length>=60){toast('Maximum 60 projects.',true);return;}
  app.site.projects.push({id:crypto.randomUUID(),title:'New project',category:'GAME DEVELOPMENT',description:'',year:String(new Date().getFullYear()),image:'',url:'',github:'',featured:false,art:'neon'});
  buildProjects();markDirty();
});
$('#add-stat').addEventListener('click',()=>{if(app.site.stats.length>=4){toast('Maximum 4 stats.',true);return;}app.site.stats.push({value:'01',label:'New stat'});buildStatEditor();markDirty();});
$('#add-service').addEventListener('click',()=>{if(app.site.services.length>=8){toast('Maximum 8 services.',true);return;}app.site.services.push({number:String(app.site.services.length+1).padStart(2,'0'),title:'New service',description:''});buildServices();markDirty();});
$('#add-social').addEventListener('click',()=>{if(app.site.socials.length>=12){toast('Maximum 12 links.',true);return;}app.site.socials.push({name:'New link',url:''});buildSocials();markDirty();});
$('#logout').addEventListener('click',async()=>{
  if(app.dirty&&!window.confirm('You have unsaved changes. Log out anyway?'))return;
  try{await api('/api/admin/logout',{method:'POST'});}catch(e){toast(e.message,true);return;}
  app.csrf='';app.site=null;app.dirty=false;currentView(false);
});
$('#password-form').addEventListener('submit',async event=>{
  event.preventDefault();const form=event.currentTarget;
  const current=form.elements.current.value;const next=form.elements.next.value;const confirm=form.elements.confirm.value;
  if(next!==confirm){toast('New passwords do not match.',true);return;}
  if(app.dirty){toast('Save your portfolio changes before changing passwords.',true);return;}
  try{
    await api('/api/admin/password',{method:'POST',body:JSON.stringify({current,next})});
    form.reset();app.csrf='';app.site=null;currentView(false);toast('Password changed. Sign in again.');
  }catch(error){toast(error.message,true);}
});
window.addEventListener('beforeunload',event=>{if(app.dirty){event.preventDefault();event.returnValue='';}});
(async()=>{
  try{
    const session=await api('/api/admin/session');
    if(!session.authenticated){currentView(false);return;}
    app.csrf=session.csrf;
    await loadDashboard();
  }catch(error){currentView(false);$('#login-error').textContent='Cannot reach the server. Please refresh.';}
})();
