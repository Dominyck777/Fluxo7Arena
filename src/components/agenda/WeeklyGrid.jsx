import React, { useMemo, useRef, useEffect } from 'react';
import { format, addDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn, getCourtColor } from '@/lib/utils';
import { Ban, DollarSign } from 'lucide-react';

// Função para limitar nome a 2 primeiros nomes
const shortName = (fullName) => {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  return parts.slice(0, 2).join(' ');
};

const SLOT_HEIGHT = 56;
const SLOT_MINUTES = 30;
const START_HOUR = 6;
const END_HOUR = 24;

export default function WeeklyGrid({
  weekStart,
  weekBookings,
  activeCourtFilter,
  courtsMap,
  participantsByAgendamento,
  onBookingClick,
  onSlotClick,
  statusConfig,
  dayStartHour = START_HOUR,
  dayEndHourExclusive = END_HOUR,
  weekDiasFuncionamento = {},
  sidebarVisible = false,
}) {
  // Refs para sincronizar scroll horizontal
  const headerRef = useRef(null);
  const gridRef = useRef(null);
  const [scrollbarWidth, setScrollbarWidth] = React.useState(0);
  const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);

  // Detectar mudanças de tamanho de tela
  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Gerar lista de dias da semana
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  // Sincronizar scroll entre header e grid (bidirecional) + detectar scrollbar
  useEffect(() => {
    const handleGridScroll = () => {
      if (gridRef.current && headerRef.current) {
        headerRef.current.scrollLeft = gridRef.current.scrollLeft;
      }
    };

    const handleHeaderScroll = () => {
      if (headerRef.current && gridRef.current) {
        gridRef.current.scrollLeft = headerRef.current.scrollLeft;
      }
    };

    // Detectar se há scrollbar vertical no grid
    const detectScrollbar = () => {
      if (gridRef.current) {
        const hasVerticalScroll = gridRef.current.scrollHeight > gridRef.current.clientHeight;
        setScrollbarWidth(hasVerticalScroll ? 17 : 0);
      }
    };

    const gridElement = gridRef.current;
    const headerElement = headerRef.current;

    if (gridElement) {
      gridElement.addEventListener('scroll', handleGridScroll);
    }
    if (headerElement) {
      headerElement.addEventListener('scroll', handleHeaderScroll);
    }

    // Detectar scrollbar inicialmente e quando resize
    detectScrollbar();
    window.addEventListener('resize', detectScrollbar);

    return () => {
      if (gridElement) gridElement.removeEventListener('scroll', handleGridScroll);
      if (headerElement) headerElement.removeEventListener('scroll', handleHeaderScroll);
      window.removeEventListener('resize', detectScrollbar);
    };
  }, []);

  // Calcular horários para o grid
  const gridHours = useMemo(() => {
    if (activeCourtFilter && courtsMap[activeCourtFilter]) {
      const court = courtsMap[activeCourtFilter];
      const startTime = court.hora_inicio || `${dayStartHour}:00:00`;
      const endTime = court.hora_fim || `${dayEndHourExclusive}:00:00`;
      const [startHour] = String(startTime).split(':').map(Number);
      const [endHour, endMinute] = String(endTime).split(':').map(Number);
      let adjustedEndHour = (endHour === 0 && endMinute === 0) ? 24 : endHour;
      if (endMinute > 0 && adjustedEndHour < 24) adjustedEndHour += 1;
      return {
        start: startHour || dayStartHour,
        end: adjustedEndHour || dayEndHourExclusive,
      };
    }
    return { start: dayStartHour, end: dayEndHourExclusive };
  }, [activeCourtFilter, courtsMap, dayStartHour, dayEndHourExclusive]);

  const displayHoursList = useMemo(() => {
    return Array.from(
      { length: Math.max(0, gridHours.end - gridHours.start) },
      (_, i) => gridHours.start + i
    );
  }, [gridHours]);

  const displayTotalGridHeight = useMemo(() => {
    return Math.max(0, (gridHours.end - gridHours.start)) * (60 / SLOT_MINUTES) * SLOT_HEIGHT;
  }, [gridHours]);

  // Agrupar agendamentos por dia
  const bookingsByDay = useMemo(() => {
    const grouped = {};
    weekDays.forEach((day) => {
      grouped[format(day, 'yyyy-MM-dd')] = [];
    });

    weekBookings.forEach((booking) => {
      const dayKey = format(startOfDay(booking.start), 'yyyy-MM-dd');
      if (grouped[dayKey]) {
        grouped[dayKey].push(booking);
      }
    });

    return grouped;
  }, [weekDays, weekBookings]);

  // Renderizar agendamento
  const renderBooking = (booking, participantsByAgendamento) => {
    const startMinutes = booking.start.getHours() * 60 + booking.start.getMinutes();
    const endMinutes = booking.end.getHours() * 60 + booking.end.getMinutes();
    const durationMinutes = endMinutes - startMinutes;
    const gridStartMinutes = gridHours.start * 60;

    const topOffset = ((startMinutes - gridStartMinutes) / SLOT_MINUTES) * SLOT_HEIGHT;
    const height = (durationMinutes / SLOT_MINUTES) * SLOT_HEIGHT;

    const statusColor = statusConfig[booking.status];
    const config = statusColor || { hex: '#888', text: 'text-gray-400', label: 'Unknown', icon: null };
    const Icon = config.icon;
    
    // Calcular tamanho da fonte baseado na altura
    const minHeight = 40;
    const adjHeight = Math.max(minHeight, height - 4);
    const fontScale = Math.min(1.3, adjHeight / 55); // Escala maior
    
    const namePx = Math.max(11, Math.round(13 * fontScale));
    const timePx = Math.max(10, Math.round(11 * fontScale));
    const smallPx = Math.max(9, Math.round(10 * fontScale));
    const iconPx = Math.max(14, Math.round(16 * fontScale));
    
    // Participantes para pagamento
    const participants = participantsByAgendamento?.[booking.id] || [];
    const paidCount = participants.filter(p => String(p.status_pagamento || '').toLowerCase() === 'pago').length;
    const totalParticipants = participants.length;
    
    const isHalfHour = durationMinutes === 30;

    return (
      <div
        key={booking.id}
        id={`booking-${booking.id}`}
        className="absolute left-0.5 right-0.5 rounded-md border-2 bg-surface cursor-pointer transition-all hover:bg-surface-2 hover:shadow-md overflow-hidden"
        style={{
          top: `${topOffset}px`,
          height: `${Math.max(minHeight, height)}px`,
          borderColor: config.hex || '#888',
          borderLeftWidth: '3px',
          zIndex: 5,
        }}
        onClick={() => onBookingClick(booking)}
      >
        <div className="h-full flex flex-col justify-center px-2 py-1">
          {/* Linha 1: Nome */}
          <div className="flex items-center gap-1.5 mb-0.5">
            <p className="font-semibold truncate" style={{ fontSize: `${namePx}px`, lineHeight: 1.1, color: '#e2e8f0' }}>
              {shortName(booking.customer)}
            </p>
          </div>
          
          {/* Linha 1b: Modalidade + Pagamentos (meia hora) */}
          {isHalfHour && (booking.modality || totalParticipants > 0) && (
            <div className="flex items-center gap-1 w-full justify-between" style={{ lineHeight: 1 }}>
              {booking.modality && (
                <span className="text-xs font-bold text-white bg-gradient-to-r from-slate-700 to-slate-800 border border-slate-600/60 rounded px-1.5 py-0.5 whitespace-nowrap shadow-sm flex-shrink-0" style={{ fontSize: Math.max(7, smallPx - 1) }}>
                  {booking.modality}
                </span>
              )}
              {totalParticipants > 0 && (
                <span className={`text-xs font-semibold rounded-full px-1.5 py-0.5 border flex items-center gap-0.5 whitespace-nowrap flex-shrink-0 ${paidCount === totalParticipants ? 'text-emerald-300 bg-emerald-500/10 border-emerald-400/30' : 'text-amber-300 bg-amber-500/10 border-amber-400/30'}`} style={{ fontSize: Math.max(8, smallPx - 1) }}>
                  <DollarSign style={{ width: Math.max(10, smallPx - 1), height: Math.max(10, smallPx - 1) }} />
                  <span>{paidCount}/{totalParticipants}</span>
                </span>
              )}
            </div>
          )}
          
          {/* Linha 2: Horário + Status (meia hora) */}
          {isHalfHour && (
            <div className="flex items-center gap-1.5 justify-between">
              <span className="font-semibold whitespace-nowrap" style={{ fontSize: `${timePx}px`, color: '#999', lineHeight: 1 }}>
                {format(booking.start, 'HH:mm')}–{format(booking.end, 'HH:mm')}
              </span>
              
              {Icon && (
                <div className="flex items-center gap-0.5">
                  {!sidebarVisible && !isMobile && (
                    <Icon style={{ width: Math.max(12, iconPx - 2), height: Math.max(12, iconPx - 2), color: config.hex }} />
                  )}
                  <span className="truncate font-semibold" style={{ fontSize: `${timePx}px`, color: config.hex, lineHeight: 1 }}>
                    {config.label}
                  </span>
                </div>
              )}
            </div>
          )}
          
          {/* Para agendamentos maiores (não meia hora) */}
          {!isHalfHour && (
            <>
              {/* Horário */}
              <div className="truncate" style={{ fontSize: `${timePx}px`, color: '#999', lineHeight: 1, marginBottom: '2px' }}>
                {format(booking.start, 'HH:mm')}–{format(booking.end, 'HH:mm')}
              </div>
              
              {/* Modalidade */}
              {booking.modality && (
                <span className="text-xs font-bold text-white truncate bg-gradient-to-r from-slate-700 to-slate-800 border border-slate-600/60 rounded px-1.5 py-0.5 whitespace-nowrap shadow-sm mb-0.5" style={{ fontSize: Math.max(7, smallPx - 1), display: 'inline-block', width: 'fit-content' }}>
                  {booking.modality}
                </span>
              )}
              
              {/* Status + Pagamentos na mesma linha */}
              <div className="flex items-center gap-1 w-full justify-between">
                {Icon && (
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {!sidebarVisible && !isMobile && (
                      <Icon style={{ width: iconPx, height: iconPx, color: config.hex }} />
                    )}
                    <span className="truncate font-semibold" style={{ fontSize: `${smallPx}px`, color: config.hex, lineHeight: 1 }}>
                      {booking.status === 'in_progress' ? 'Andamento' : config.label}
                    </span>
                  </div>
                )}
                
                {totalParticipants > 0 && (
                  <span className={`text-xs font-semibold rounded-full px-1.5 py-0.5 border flex items-center gap-0.5 whitespace-nowrap flex-shrink-0 ${paidCount === totalParticipants ? 'text-emerald-300 bg-emerald-500/10 border-emerald-400/30' : 'text-amber-300 bg-amber-500/10 border-amber-400/30'}`} style={{ fontSize: Math.max(8, smallPx - 1) }}>
                    <DollarSign style={{ width: Math.max(12, smallPx), height: Math.max(12, smallPx) }} />
                    <span>{paidCount}/{totalParticipants}</span>
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 bg-surface rounded-lg border border-border flex flex-col overflow-hidden">
      {/* Header com dias da semana */}
      <div className="flex sticky top-0 z-20 bg-surface border-b border-border">
        {/* Coluna de horários (header) */}
        <div className="w-20 flex-shrink-0 flex items-center justify-center font-semibold text-sm border-r border-border bg-surface">
          Horários
        </div>
        
        {/* Headers dos dias - wrapper com overflow auto para sincronizar com grid */}
        <div ref={headerRef} data-header-scroll className="flex flex-1 overflow-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', paddingRight: `${scrollbarWidth}px`, minWidth: 0 }}>
          <style>{`
            [data-header-scroll]::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          {weekDays.map((day) => (
            <div
              key={format(day, 'yyyy-MM-dd')}
              className="flex-1 basis-[140px] min-w-[140px] flex flex-col items-center justify-center py-3 border-r border-border bg-surface-2/50 text-center"
            >
              <div className="text-xs font-semibold text-text-muted">
                {format(day, 'EEE', { locale: ptBR }).toUpperCase()}
              </div>
              <div className="text-sm font-bold text-text-primary">
                {format(day, 'dd')}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Grid de horários e agendamentos */}
      <div ref={gridRef} className="flex flex-1 overflow-auto" style={{ minWidth: 0 }}>
        {/* Coluna de horários (esquerda) */}
        <div className="w-20 flex-shrink-0 bg-surface sticky left-0 z-10 flex flex-col relative" style={{ borderRight: `1px solid var(--color-border)`, minHeight: `${displayTotalGridHeight}px` }}>
          {displayHoursList.map((hour) => (
            <React.Fragment key={`time-${hour}`}>
              {/* Slot :00 */}
              <div className={cn('relative border-b border-border/60', hour % 2 === 1 && 'bg-surface-2/30')} style={{ height: SLOT_HEIGHT }}>
                <span className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 bg-surface rounded px-1 text-sm font-bold whitespace-nowrap">
                  {String(hour).padStart(2, '0')}:00
                </span>
              </div>
              {/* Slot :30 */}
              <div className={cn('relative border-b border-border/60', hour % 2 === 1 && 'bg-surface-2/30')} style={{ height: SLOT_HEIGHT }}>
                <span className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 bg-surface rounded px-1 text-sm font-bold whitespace-nowrap">
                  {String(hour).padStart(2, '0')}:30
                </span>
              </div>
            </React.Fragment>
          ))}
          {/* Linha vertical persistente na borda direita */}
          <div className="absolute right-0 top-0 w-px bg-border pointer-events-none" style={{ height: `${displayTotalGridHeight}px` }} />
        </div>

        {/* Colunas dos dias */}
        {weekDays.map((day) => {
          const dayKey = format(day, 'yyyy-MM-dd');
          const dayBookings = bookingsByDay[dayKey] || [];
          const dayFuncionamento = weekDiasFuncionamento[dayKey] || {};
          const isCourtClosed = activeCourtFilter && dayFuncionamento[activeCourtFilter] && !dayFuncionamento[activeCourtFilter].funciona;

          return (
            <div
              key={dayKey}
              className="flex-1 basis-[140px] min-w-[140px] relative border-r border-border bg-surface-2/10"
              style={{ minHeight: `${displayTotalGridHeight}px` }}
            >
              {/* Grid de horários */}
              {displayHoursList.map((hour) => (
                <div key={`${dayKey}-${hour}`} className={cn('border-b border-border/60', hour % 2 === 1 && 'bg-surface-2/5')} style={{ height: SLOT_HEIGHT * 2 }}>
                  {isCourtClosed ? (
                    // Bloco de 1 hora para quadra fechada
                    <div 
                      className="w-full h-full cursor-not-allowed bg-surface/60 flex items-center justify-center border-b border-border/60 transition-colors"
                      onClick={(e) => e.preventDefault()}
                    >
                      <div className="text-center pointer-events-none">
                        <Ban className="h-5 w-5 text-text-primary mx-auto mb-1" />
                        <div className="text-xs font-medium text-text-primary mb-1">Fechada</div>
                        {dayFuncionamento[activeCourtFilter]?.observacao && (
                          <div className="text-xs text-text-muted">
                            {dayFuncionamento[activeCourtFilter].observacao}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    // Dois slots de 30 minutos para quadra aberta
                    <>
                      {/* Slot :00 */}
                      <div 
                        className="relative border-b border-border/60 transition-colors flex items-center justify-center cursor-pointer hover:bg-white/5"
                        style={{ height: SLOT_HEIGHT }}
                        onClick={() => {
                          const slotDate = new Date(day.getTime());
                          slotDate.setHours(hour, 0, 0, 0);
                          console.log('Slot :00 clicked', { day, hour, slotDate, activeCourtFilter });
                          onSlotClick?.(slotDate, activeCourtFilter);
                        }}
                      />
                      {/* Slot :30 */}
                      <div 
                        className="relative border-b border-border/60 transition-colors flex items-center justify-center cursor-pointer hover:bg-white/5"
                        style={{ height: SLOT_HEIGHT }}
                        onClick={() => {
                          const slotDate = new Date(day.getTime());
                          slotDate.setHours(hour, 30, 0, 0);
                          console.log('Slot :30 clicked', { day, hour, slotDate, activeCourtFilter });
                          onSlotClick?.(slotDate, activeCourtFilter);
                        }}
                      />
                    </>
                  )}
                </div>
              ))}

              {/* Agendamentos do dia */}
              {dayBookings.map((booking) => renderBooking(booking, participantsByAgendamento))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
