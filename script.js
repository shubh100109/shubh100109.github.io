// Loader hide once page fully loaded
window.addEventListener('load', () => {
  const loader = document.getElementById('page-loader');
  loader.style.opacity = '0';
  setTimeout(()=> loader.style.display = 'none', 450);
});

// Navbar color + active link highlight
const navbar = document.getElementById('navbar');
const navLinks = document.querySelectorAll('.nav-links a');
const sections = document.querySelectorAll('section');
window.addEventListener('scroll', ()=>{
  navbar.classList.toggle('scrolled', window.scrollY > 60);
  let current = '';
  sections.forEach(sec=>{
    const top = sec.offsetTop - 140;
    const height = sec.offsetHeight;
    if(window.scrollY >= top && window.scrollY < top + height){
      current = sec.id;
    }
  });
  navLinks.forEach(a=>{
    a.classList.remove('active');
    if(a.getAttribute('href') === '#'+current) a.classList.add('active');
  });
});

// Intersection observer for fade-in
const faders = document.querySelectorAll('.fade-in');
const appearOptions = { threshold: 0.18, rootMargin: '0px 0px -50px 0px' };
const appearOnScroll = new IntersectionObserver((entries, obs)=>{
  entries.forEach(entry=>{
    if(!entry.isIntersecting) return;
    entry.target.classList.add('visible');
    obs.unobserve(entry.target);
  });
}, appearOptions);
faders.forEach(f=> appearOnScroll.observe(f));

// Simple carousel controls
function wireCarousel(trackId){
  const track = document.getElementById(trackId);
  if(!track) return;
  const leftBtn = document.querySelector('.carousel-btn.left[data-target="'+(trackId==='case-track'?'case':'show')+'"]');
  const rightBtn = document.querySelector('.carousel-btn.right[data-target="'+(trackId==='case-track'?'case':'show')+'"]');
  let index = 0;
  function update(n){
    const items = track.children.length;
    index = Math.max(0, Math.min(n, items-1));
    const child = track.children[index];
    const left = child.offsetLeft - (track.clientWidth/2) + (child.clientWidth/2);
    track.scrollTo({left, behavior:'smooth'});
  }
  leftBtn && leftBtn.addEventListener('click', ()=> update(index-1));
  rightBtn && rightBtn.addEventListener('click', ()=> update(index+1));
}
// wire both
wireCarousel('case-track');
wireCarousel('show-track');

// ensure hero video is visible (if user adds video file)
const heroVideo = document.getElementById('heroVideo');
heroVideo.addEventListener('error', () => {
  document.querySelector('.hero-section').style.background = "url('assets/hero-fallback.jpg') center/cover no-repeat";
});
