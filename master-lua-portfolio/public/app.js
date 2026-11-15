const $ = (sel) => document.querySelector(sel);
const setText = (sel, value) => { const element = $(sel); if(element) element.textContent = value || ''; };
const el = (tag, className, text) => {const node=document.createElement(tag); if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
const safeHref = (raw) => {
  try {const url = new URL(raw);return ['https:','http:'].includes(url.protocol)?url.href:'';} catch {return '';}
};
const animate = () => {
  const nodes = document.querySelectorAll('.reveal:not(.visible)');
  if (!('IntersectionObserver' in window)) {nodes.forEach(node=>node.classList.add('visible'));return;}
  const observer=new IntersectionObserver((items)=>{for(const item of items)if(item.isIntersecting){item.target.classList.add('visible');observer.unobserve(item.target);}}, {threshold:.1,rootMargin:'0px 0px -35px 0px'});
  nodes.forEach(node=>observer.observe(node));
};
const renderProjects = (projects) => {
  const wrapper = $('#projects');wrapper.replaceChildren();
  if(!projects.length){wrapper.append(el('p','project-empty','Projects coming soon.'));return;}
  projects.forEach((project,index)=>{
    const card=el('article','project-card reveal');
    const media=el('div',`project-media art-${project.art||'neon'}`);
    if(project.image){const img=el('img');img.src=project.image;img.alt=`${project.title} showcase artwork`;img.loading='lazy';media.append(img);}
    media.append(el('div','project-overlay'));
    media.append(el('span','project-index',String(index+1).padStart(2,'0')+' / '+String(projects.length).padStart(2,'0')));
    const dest=safeHref(project.url)||safeHref(project.github);
    if(dest){const anchor=el('a','project-arrow','↗');anchor.href=dest;anchor.target='_blank';anchor.rel='noopener noreferrer';anchor.setAttribute('aria-label',`Visit ${project.title}`);media.append(anchor);}else{const pill=el('span','project-arrow','↗');pill.setAttribute('aria-hidden','true');media.append(pill);}
    const details=el('div','project-details');const info=el('div');
    info.append(el('div','project-category',project.category||'PROJECT'));
    info.append(el('h3','',project.title));
    info.append(el('p','project-description',project.description||''));
    details.append(info,el('span','project-year',project.year||''));
    card.append(media,details);wrapper.append(card);
  });
};
const render = (data) => {
  document.documentElement.style.setProperty('--accent',data.accent||'#ccfa5a');
  document.title=`${data.name||'Portfolio'} — ${data.role||'Developer'}`;
  setText('#brand-name',(data.name||'PORTFOLIO').toUpperCase());
  setText('#footer-name',(data.name||'PORTFOLIO').toUpperCase());
  setText('#eyebrow',data.eyebrow);setText('#headline',data.headline);setText('#headline-accent',data.headlineAccent);
  setText('#intro',data.intro);setText('#location',data.location);
  setText('#about-title',data.aboutTitle);setText('#about-text',data.about);
  setText('#availability',data.availability);setText('#contact-title',data.contactTitle);
  setText('#contact-email-label',data.email);setText('#footer-text',data.footer);
  const email=$('#email-link');email.href=`mailto:${encodeURIComponent(data.email||'')}`;
  renderProjects(data.projects||[]);
  const stats=$('#stats');stats.replaceChildren();
  (data.stats||[]).forEach(x=>{const item=el('div','about-stat');item.append(el('strong','',x.value),el('span','',x.label));stats.append(item);});
  const services=$('#services');services.replaceChildren();
  (data.services||[]).forEach((s,i)=>{
    const card=el('article','service-card reveal');
    card.append(el('span','service-number',s.number||String(i+1).padStart(2,'0')),
      el('span','service-icon',['✳','◈','↗','◎'][i%4]),
      el('h3','',s.title),el('p','',s.description));services.append(card);
  });
  const skills=$('#skills');skills.replaceChildren();
  (data.skills||[]).forEach(s=>skills.append(el('span','skill-pill',s)));
  const socials=$('#socials');socials.replaceChildren();
  (data.socials||[]).forEach(s=>{const href=safeHref(s.url);if(!href)return;const anchor=el('a','',s.name+' ↗');anchor.href=href;anchor.target='_blank';anchor.rel='noopener noreferrer';socials.append(anchor);});
  animate();
  window.dispatchEvent(new CustomEvent('portfolio:rendered'));
};
fetch('/api/site').then(r=>{if(!r.ok)throw Error('Site content unavailable');return r.json();}).then(render).catch(error=>{console.warn(error);animate();});
const menuButton=$('#mobile-menu-btn');const mobileMenu=$('#mobile-nav');
menuButton.addEventListener('click',()=>{
  const expanded=menuButton.getAttribute('aria-expanded')==='true';
  menuButton.setAttribute('aria-expanded',String(!expanded));
  mobileMenu.hidden=expanded;
});
mobileMenu.addEventListener('click',event=>{if(event.target.closest('a')){mobileMenu.hidden=true;menuButton.setAttribute('aria-expanded','false');}});
animate();
