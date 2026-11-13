document.querySelectorAll('[data-tabs]').forEach(group => {
  const buttons = group.querySelectorAll('[data-tab]');
  const panels = group.querySelectorAll('[data-panel]');
  buttons.forEach(button => button.addEventListener('click', () => {
    const key = button.dataset.tab;
    buttons.forEach(item => item.classList.toggle('active', item === button));
    panels.forEach(panel => panel.hidden = panel.dataset.panel !== key);
  }));
});
document.querySelectorAll('[data-action="toast"]').forEach(button => button.addEventListener('click', () => {
  const toast = document.createElement('div');
  toast.textContent = button.dataset.message || '已保存';
  Object.assign(toast.style, { position: 'fixed', right: '22px', bottom: '22px', padding: '12px 16px', borderRadius: '9px', background: '#252e52', color: '#fff', boxShadow: '0 10px 28px rgba(0,0,0,.18)', zIndex: 10 });
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1800);
}));
document.querySelectorAll('[data-toggle]').forEach(button => button.addEventListener('click', () => {
  const target = document.querySelector(button.dataset.toggle);
  if (target) target.hidden = !target.hidden;
}));
