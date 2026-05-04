export const setupTextareaForceEnd = () => {
  // Buscamos el textarea directamente por su clase
  const textarea = document.querySelector('.input-text-area');

  if (textarea) {
    // Forzar posición al hacer click
    textarea.addEventListener('mousedown', (e) => {
      // Si el preventDefault te da problemas para escribir,
      // puedes usar un setTimeout pequeño para mover el cursor
      setTimeout(() => {
        const end = textarea.value.length;
        textarea.setSelectionRange(end, end);
      }, 0);
    });

    // También es bueno forzarlo al ganar el foco (por ejemplo, con TAB)
    textarea.addEventListener('focus', () => {
      const end = textarea.value.length;
      textarea.setSelectionRange(end, end);
    });
  }
};
