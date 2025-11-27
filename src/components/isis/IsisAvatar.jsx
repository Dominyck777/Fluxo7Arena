/**
 * Avatar da Isis - Assistente Virtual
 * Suporta diferentes variantes de imagem
 */

export const IsisAvatar = ({ size = 'md', variant = 'header', className = '' }) => {
  const sizes = {
    xs: 'w-8 h-8',    // Extra pequeno (header/atalhos)
    sm: 'w-10 h-10',  // Pequeno
    md: 'w-14 h-14',  // Médio (mensagens)
    lg: 'w-20 h-20',  // Grande (header)
    xl: 'w-24 h-24'   // Extra grande (landing)
  };
  
  // Avatar da Isis - Imagens personalizadas
  const avatarUrls = {
    header: '/isis-profile.png',        // Para header
    message: '/isis-profile-baloon.png' // Para mensagens e typing
  };
  
  const avatarUrl = avatarUrls[variant] || avatarUrls.header;
  
  const scaleClass = size === 'lg' ? 'scale-125' : size === 'md' ? 'scale-110' : 'scale-100';

  return (
    <div className={`${sizes[size] || sizes.md} rounded-full overflow-hidden flex-shrink-0 ring-2 ring-brand ring-offset-0 ${className}`}>
      <img 
        src={avatarUrl}
        alt="Assistente Virtual"
        className={`w-full h-full object-cover ${scaleClass}`}
        onError={(e) => {
          // Fallback caso imagem não carregue
          e.target.style.display = 'none';
          e.target.parentElement.innerHTML = `
            <div class="w-full h-full bg-brand flex items-center justify-center">
              <span class="text-bg font-bold text-lg">A</span>
            </div>
          `;
        }}
      />
    </div>
  );
};
