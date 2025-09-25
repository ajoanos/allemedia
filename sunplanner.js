
/* SunPlanner v1.7.3 - rozbudowany planer z planowaniem słońca, radarową warstwą mapy, autosave i eksportami */

(function(){
  var CFG = window.SUNPLANNER_CFG || {};
  var GMAPS_KEY    = CFG.GMAPS_KEY || '';
  var CSE_ID       = CFG.CSE_ID || '';
  var UNSPLASH_KEY = CFG.UNSPLASH_KEY || '';
  var TZ           = CFG.TZ || (Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Warsaw');
  var REST_URL     = CFG.REST_URL || '';
  var SITE_ORIGIN  = CFG.SITE_ORIGIN || '';
  var RADAR_URL    = CFG.RADAR_URL || '';
  var NOTIFY_URL   = CFG.NOTIFY_URL || '';
  var BASE_URL = (function(){
    function stripQueryAndHash(url){ return url.replace(/[?#].*$/, ''); }
    var locOrigin = location.origin || (location.protocol + '//' + location.host);
    var locPath = location.pathname || '/';
    var defaultBase = stripQueryAndHash(locOrigin + locPath);
    if(!SITE_ORIGIN){
      return defaultBase;
    }

    var siteBase = null;
    try {
      var siteUrl = new URL(SITE_ORIGIN, locOrigin);
      var path = siteUrl.pathname || '/';
      var isDedicatedHost = siteUrl.origin !== locOrigin;
      var isDedicatedPath = (path !== '/' && path !== '');
      if(isDedicatedHost || isDedicatedPath){
        siteBase = stripQueryAndHash(siteUrl.origin + path);
      }
    } catch(e){}

    return siteBase || defaultBase;
  })();

  var root = document.getElementById('sunplanner-app');
  if(!root){ console.warn('SunPlanner: brak #sunplanner-app'); return; }

  root.innerHTML =
  '<div class="sunplanner">'+
    '<div id="sp-toast" class="banner" style="display:none"></div>'+
    '<div class="row">'+
      '<input id="sp-place" class="input" placeholder="Dodaj punkt: start / przystanek / cel">'+
      '<button id="sp-add" class="btn" type="button">Dodaj</button>'+
      '<button id="sp-geo" class="btn secondary" type="button">Skąd jadę?</button>'+
      '<input id="sp-date" class="input" type="date" style="max-width:170px">'+
      '<button id="sp-clear" class="btn secondary" type="button">Wyczyść</button>'+
    '</div>'+
    '<div class="toolbar">'+
      '<label class="switch"><input id="sp-radar" type="checkbox"><span class="switch-pill" aria-hidden="true"></span><span class="switch-label">Radar opadów</span></label>'+
      '<div class="legend">'+
        '<span class="c1"><i></i>Najlepsza</span>'+
        '<span class="c2"><i></i>Alternatywa</span>'+
        '<span class="c3"><i></i>Opcja</span>'+
      '</div>'+
    '</div>'+
    '<div id="planner-map" aria-label="Mapa"></div>'+
    '<div class="card route-card">'+
      '<h3>Punkty trasy (start, przystanki, cel podróży)</h3>'+
      '<div id="sp-list"></div>'+
      '<h3 class="alt-heading">Alternatywne trasy przejazdu</h3>'+
      '<div id="sp-route-choices" class="route-options"></div>'+
    '</div>'+
    '<div class="cards">'+
    '<div class="card">'+
      '<h3>Plan dnia – przebieg zdjęć</h3>'+
      '<div id="sp-session-summary" class="session-summary">'+
        '<strong>Wybierz lokalizację i datę</strong>'+
        '<span class="session-summary__lead">Dodaj cel podróży, aby ocenić warunki sesji w plenerze.</span>'+
      '</div>'+
        '<div class="rowd"><span>Cel (ostatni punkt)</span><strong id="sp-loc">—</strong></div>'+
        '<div class="rowd"><span>Data</span><strong id="sp-date-label">—</strong></div>'+
        '<div class="rowd"><span>Czas jazdy</span><strong id="sp-t-time">—</strong></div>'+
        '<div class="rowd"><span>Dystans</span><strong id="sp-t-dist">—</strong></div>'+

        '<div class="golden-block">'+
          '<div class="grid2 glow-grid">'+
            '<div class="card inner">'+
              '<h3>Świt <small id="sp-rise-date" class="muted"></small></h3>'+
              '<div class="rowd"><span>Świt</span><strong id="sp-rise-sun">—</strong></div>'+
              '<div class="rowd"><span>Start</span><strong id="sp-rise-start">—</strong></div>'+
              '<div class="rowd"><span>Wyjazd</span><strong id="sp-rise-wake">—</strong></div>'+
              '<div class="rowd"><span>Sen od</span><strong id="sp-rise-bed">—</strong></div>'+
              '<p class="muted" style="margin:.25rem 0 .4rem">Ile snu chcesz mieć?</p>'+
              '<div style="display:flex;align-items:center;gap:.7rem">'+
                '<div class="ring">'+
                  '<svg width="56" height="56"><circle cx="28" cy="28" r="24" stroke="#e5e7eb" stroke-width="4" fill="none"></circle><circle id="sp-ring-rise" cx="28" cy="28" r="24" stroke="#e94244" stroke-width="4" fill="none" stroke-linecap="round"></circle></svg>'+
                  '<div class="text" id="sp-txt-rise">6 h</div>'+
                '</div>'+
                '<input id="sp-slider-rise" class="slider" type="range" min="1" max="8" step="1" value="6" style="flex:1">'+
              '</div>'+
              '<div class="kpi">'+
                '<div class="rowd"><span>Temp.</span><strong id="sp-rise-t">—</strong></div>'+
                '<div class="rowd"><span>Wiatr</span><strong id="sp-rise-w">—</strong></div>'+
                '<div class="rowd"><span>Chmury</span><strong id="sp-rise-c">—</strong></div>'+
                '<div class="rowd"><span>Wilg.</span><strong id="sp-rise-h">—</strong></div>'+
                '<div class="rowd"><span>Widocz.</span><strong id="sp-rise-v">—</strong></div>'+
                '<div class="rowd"><span>Opady</span><strong id="sp-rise-p">—</strong></div>'+
              '</div>'+
              '<div class="glow-info morning">'+
                '<h4>Poranek</h4>'+
                '<p id="sp-gold-am" class="glow-line">☀️ Poranna złota godzina: — —</p>'+
                '<p id="sp-blue-am" class="glow-line">🌌 Poranna niebieska godzina: — —</p>'+
              '</div>'+
            '</div>'+
            '<div class="card inner">'+
              '<h3>Zachód <small id="sp-set-date" class="muted"></small></h3>'+
              '<div class="rowd"><span>Zachód</span><strong id="sp-set-sun">—</strong></div>'+
              '<div class="rowd"><span>Start</span><strong id="sp-set-start">—</strong></div>'+
              '<div class="rowd"><span>Wyjazd</span><strong id="sp-set-wake">—</strong></div>'+
              '<div class="rowd"><span>Czas na przygotowania</span><strong id="sp-set-bed">—</strong></div>'+
              '<p class="muted" style="margin:.25rem 0 .4rem">Dopasuj czas, aby wszystko dopiąć.</p>'+
              '<div style="display:flex;align-items:center;gap:.7rem">'+
                '<div class="ring">'+
                  '<svg width="56" height="56"><circle cx="28" cy="28" r="24" stroke="#e5e7eb" stroke-width="4" fill="none"></circle><circle id="sp-ring-set" cx="28" cy="28" r="24" stroke="#e94244" stroke-width="4" fill="none" stroke-linecap="round"></circle></svg>'+
                  '<div class="text" id="sp-txt-set">6 h</div>'+
                '</div>'+
                '<input id="sp-slider-set" class="slider" type="range" min="1" max="8" step="1" value="6" style="flex:1">'+
              '</div>'+
              '<div class="kpi">'+
                '<div class="rowd"><span>Temp.</span><strong id="sp-set-t">—</strong></div>'+
                '<div class="rowd"><span>Wiatr</span><strong id="sp-set-w">—</strong></div>'+
                '<div class="rowd"><span>Chmury</span><strong id="sp-set-c">—</strong></div>'+
                '<div class="rowd"><span>Wilg.</span><strong id="sp-set-h">—</strong></div>'+
                '<div class="rowd"><span>Widocz.</span><strong id="sp-set-v">—</strong></div>'+
                '<div class="rowd"><span>Opady</span><strong id="sp-set-p">—</strong></div>'+
              '</div>'+
              '<div class="glow-info align-right evening">'+
                '<h4>Wieczór</h4>'+
                '<p id="sp-gold-pm" class="glow-line">☀️ Wieczorna złota godzina: — —</p>'+
                '<p id="sp-blue-pm" class="glow-line">🌌 Wieczorna niebieska godzina: — —</p>'+
              '</div>'+
            '</div>'+
          '</div>'+

        '</div>'+

        '<div class="card" style="margin-top:1rem;padding:.75rem">'+
          '<h3>Galeria inspiracji – zdjęcia</h3>'+
          '<div id="sp-gallery"></div>'+
        '</div>'+
        '<div id="sp-location-insights" class="location-insights">'+
          '<h3>Zasady na miejscu</h3>'+
          '<p class="muted">Dodaj cel podróży, aby sprawdzić zasady dla dronów.</p>'+
        '</div>'+
      '</div>'+
      '<div class="card">'+
        '<h3>Mini-wykres godzinowy – prognoza pogody</h3>'+
        '<canvas id="sp-hourly" class="smallcanvas" aria-label="Prognoza godzinowa"></canvas>'+
        '<div class="weather-legend">'+

          '<span><i class="line"></i>Temperatura (°C)</span>'+
          '<span><i class="bar weak"></i>Opady 0–0,5 mm</span>'+
          '<span><i class="bar medium"></i>Opady 0,6–2 mm</span>'+
          '<span><i class="bar heavy"></i>Opady powyżej 2 mm</span>'+

        '</div>'+
        '<div class="sunshine-block">'+
          '<h3>Godziny ze słońcem</h3>'+
          '<canvas id="sp-sunshine" class="smallcanvas sunshine-canvas" aria-label="Godziny nasłonecznienia"></canvas>'+
          '<div class="weather-legend sunshine-legend">'+
            '<span><i class="bar sun-weak"></i>Przebłyski</span>'+
            '<span><i class="bar sun-medium"></i>Słońce przez część godziny</span>'+
            '<span><i class="bar sun-strong"></i>Pełne słońce</span>'+
          '</div>'+
        '</div>'+
      '</div>'+
    '</div>'+
    '<div class="card share-card">'+
      '<h3>Udostępnij / Eksport</h3>'+
      '<div class="row share-row" style="align-items:flex-start">'+
        '<div class="col" style="flex:1">'+
          '<div class="row" style="gap:.35rem;flex-wrap:wrap">'+
            '<button id="sp-copy" class="btn secondary" type="button">Kopiuj link</button>'+
            '<button id="sp-short" class="btn secondary" type="button">Krótki link</button>'+
            '<button id="sp-ics" class="btn secondary" type="button">Eksport do kalendarza</button>'+
            '<button id="sp-client-card" class="btn secondary" type="button">Karta klienta</button>'+
            '<button id="sp-print" class="btn secondary" type="button">Drukuj / PDF</button>'+
          '</div>'+
          '<div class="muted" id="sp-link" style="margin-top:.25rem;word-break:break-all"></div>'+
          '<div class="muted" id="sp-short-status"></div>'+
        '</div>'+
      '</div>'+
    '</div>'+
    '<div class="card planner-card">'+
      '<h3>Planer terminów sesji plenerowej</h3>'+
      '<p class="muted">Zbierz propozycje terminów od młodej pary i fotografa oraz zatwierdź najlepszy termin.</p>'+
      '<div class="planner-grid">'+
        '<section class="planner-section">'+
          '<div class="planner-section__header">'+
            '<h4>Propozycje młodej pary</h4>'+
            '<p class="muted">Dodaj kilka dogodnych terminów, aby fotograf mógł je zaakceptować lub odrzucić.</p>'+
          '</div>'+
          '<label class="planner-field">'+
            '<span>Email młodej pary</span>'+
            '<input id="sp-couple-email" class="input" type="email" placeholder="np. para@example.com">'+
          '</label>'+
          '<label class="planner-field">'+
            '<span>Uwagi od młodej pary</span>'+
            '<textarea id="sp-couple-notes" class="input" rows="3" placeholder="Dodatkowe informacje, preferencje, prośby"></textarea>'+
          '</label>'+
          '<div class="planner-add">'+
            '<input id="sp-couple-date" class="input" type="date">'+
            '<input id="sp-couple-time" class="input" type="time">'+
            '<button id="sp-couple-add" class="btn secondary" type="button">Dodaj termin</button>'+
          '</div>'+
          '<div id="sp-couple-slots" class="planner-slots"></div>'+
        '</section>'+
        '<section class="planner-section">'+
          '<div class="planner-section__header">'+
            '<h4>Terminy proponowane przez fotografa</h4>'+
            '<p class="muted">Fotograf może zaproponować własne wolne terminy, a para zaakceptuje najlepszy.</p>'+
          '</div>'+
          '<label class="planner-field">'+
            '<span>Email fotografa</span>'+
            '<input id="sp-photographer-email" class="input" type="email" placeholder="np. fotograf@example.com">'+
          '</label>'+
          '<label class="planner-field">'+
            '<span>Uwagi fotografa</span>'+
            '<textarea id="sp-photographer-notes" class="input" rows="3" placeholder="Uwagi organizacyjne, dodatkowe informacje"></textarea>'+
          '</label>'+
          '<div class="planner-add">'+
            '<input id="sp-photographer-date" class="input" type="date">'+
            '<input id="sp-photographer-time" class="input" type="time">'+
            '<button id="sp-photographer-add" class="btn secondary" type="button">Dodaj termin</button>'+
          '</div>'+
          '<div id="sp-photographer-slots" class="planner-slots"></div>'+
        '</section>'+
      '</div>'+
      '<div class="planner-actions">'+
        '<div class="planner-actions__buttons">'+
          '<button id="sp-notify-photographer" class="btn secondary" type="button">Powiadom fotografa</button>'+
          '<button id="sp-notify-couple" class="btn secondary" type="button">Powiadom młodą parę</button>'+
        '</div>'+
        '<div id="sp-planner-status" class="muted"></div>'+
      '</div>'+
    '</div>'+
  '</div>';
  sessionSummaryDefault();
  applyPlannerState(null);

  // helpers
  function $(s){ return document.querySelector(s); }
  function toast(m,type){ var t=$("#sp-toast"); t.textContent=m; t.style.display='block'; t.style.background=(type==='ok'?'#dcfce7':'#fee2e2'); t.style.color=(type==='ok'?'#14532d':'#991b1b'); clearTimeout(toast._t); toast._t=setTimeout(function(){t.style.display='none';}, 4200); }
  function fmt(d){ return d instanceof Date && !isNaN(d) ? d.toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'}) : '—'; }
  function escapeHtml(str){
    return String(str==null?'':str).replace(/[&<>"']/g,function(ch){
      switch(ch){
        case '&': return '&amp;';
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '"': return '&quot;';
        case '\'': return '&#39;';
        default: return ch;
      }
    });
  }
  function setText(id,v){ var el=(id.charAt(0)==='#'?$(id):$('#'+id)); if(el) el.textContent=v; }
  function deg(rad){ return rad*180/Math.PI; }
  function bearingFromAzimuth(az){ return (deg(az)+180+360)%360; }
  function isValidDate(d){ return d instanceof Date && !isNaN(d); }
  function addMinutes(date, minutes){ if(!isValidDate(date)) return null; return new Date(date.getTime()+minutes*60000); }
  function normalizeLabel(str){
    if(!str) return '';
    var lower=String(str).toLowerCase();
    if(typeof lower.normalize==='function'){ lower=lower.normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
    var map={ 'ą':'a','ć':'c','ę':'e','ł':'l','ń':'n','ó':'o','ś':'s','ż':'z','ź':'z' };
    return lower.replace(/[ąćęłńóśżź]/g,function(ch){ return map[ch]||ch; });
  }

  function projectPoint(lat,lng,distanceMeters,bearingDeg){
    var R=6378137;
    var br=bearingDeg*Math.PI/180;
    var lat1=lat*Math.PI/180;
    var lng1=lng*Math.PI/180;
    var dr=distanceMeters/R;
    var lat2=Math.asin(Math.sin(lat1)*Math.cos(dr)+Math.cos(lat1)*Math.sin(dr)*Math.cos(br));
    var lng2=lng1+Math.atan2(Math.sin(br)*Math.sin(dr)*Math.cos(lat1),Math.cos(dr)-Math.sin(lat1)*Math.sin(lat2));
    return {lat:lat2*180/Math.PI,lng:lng2*180/Math.PI};
  }

  function summaryElement(){ return document.getElementById('sp-session-summary'); }
  function setSessionSummary(html){ var el=summaryElement(); if(el){ el.innerHTML=html; } }
  function sessionSummaryDefault(){ setSessionSummary('<strong>Wybierz lokalizację i datę</strong><span class="session-summary__lead">Dodaj cel podróży, aby ocenić warunki sesji w plenerze.</span>'); }
  function sessionSummaryLoading(){ setSessionSummary('<strong>Analizuję prognozę…</strong><span class="session-summary__lead">Sprawdzam pogodę i najlepsze okna na zdjęcia.</span>'); }
  function sessionSummaryNoData(){ setSessionSummary('<strong>Brak prognozy pogodowej</strong><span class="session-summary__lead">Spróbuj ponownie później lub wybierz inną lokalizację.</span>'); }

  var plannerState = {
    couple: { email:'', notes:'', slots:[] },
    photographer: { email:'', notes:'', slots:[] }
  };

  function generateSlotId(){
    return 'slot-' + Date.now().toString(36) + Math.random().toString(36).slice(2,8);
  }

  function normalizeSlot(slot){
    if(!slot || typeof slot !== 'object') return null;
    var date = typeof slot.date === 'string' ? slot.date : '';
    var time = typeof slot.time === 'string' ? slot.time : '';
    var status = slot.status === 'accepted' || slot.status === 'declined' ? slot.status : 'pending';
    var id = typeof slot.id === 'string' && slot.id ? slot.id : generateSlotId();
    return { id:id, date:date, time:time, status:status };
  }

  function plannerStatusLabel(status){
    switch(status){
      case 'accepted': return 'zaakceptowano';
      case 'declined': return 'nie pasuje';
      default: return 'oczekuje na decyzję';
    }
  }

  function formatSlotLabel(slot){
    if(!slot) return '';
    var date = slot.date || '';
    var time = slot.time || '';
    if(date){
      var parts = date.split('-');
      if(parts.length === 3){
        var year = Number(parts[0]);
        var month = Number(parts[1]) - 1;
        var day = Number(parts[2]);
        if(!isNaN(year) && !isNaN(month) && !isNaN(day)){
          if(time){
            var tParts = time.split(':');
            var hour = Number(tParts[0] || 0);
            var minute = Number(tParts[1] || 0);
            var dt = new Date(year, month, day, hour, minute);
            if(!isNaN(dt.getTime())){
              return dt.toLocaleString('pl-PL',{ dateStyle:'long', timeStyle:'short' });
            }
          } else {
            var dOnly = new Date(year, month, day);
            if(!isNaN(dOnly.getTime())){
              return dOnly.toLocaleDateString('pl-PL',{ dateStyle:'long' });
            }
          }
        }
      }
    }
    return (date||'') + (time ? ' ' + time : '');
  }

  function plannerSlotClass(status){
    if(status === 'accepted') return 'planner-slot planner-slot--accepted';
    if(status === 'declined') return 'planner-slot planner-slot--declined';
    return 'planner-slot';
  }

  function renderPlannerSlots(side){
    var containerId = side === 'photographer' ? 'sp-photographer-slots' : 'sp-couple-slots';
    var container = document.getElementById(containerId);
    if(!container) return;
    var slots = plannerState[side] && Array.isArray(plannerState[side].slots) ? plannerState[side].slots : [];
    if(!slots.length){
      container.innerHTML = '<p class="muted">Brak proponowanych terminów.</p>';
      return;
    }
    var html = '<ul class="planner-slot-list">';
    slots.forEach(function(slot){
      var cls = plannerSlotClass(slot.status);
      var label = formatSlotLabel(slot);
      var statusText = plannerStatusLabel(slot.status);
      var id = slot.id || generateSlotId();
      slot.id = id;
      html += '<li class="'+cls+'" data-slot-id="'+escapeHtml(id)+'">';
      html += '<div class="planner-slot__info">'+escapeHtml(label||'Termin bez daty')+'<span class="planner-slot__status">'+escapeHtml(statusText)+'</span></div>';
      html += '<div class="planner-slot__actions">';
      html += '<button type="button" class="planner-slot__btn" data-action="accept" data-slot-id="'+escapeHtml(id)+'">Akceptuj</button>';
      html += '<button type="button" class="planner-slot__btn planner-slot__btn--decline" data-action="decline" data-slot-id="'+escapeHtml(id)+'">Nie pasuje</button>';
      html += '</div>';
      html += '</li>';
    });
    html += '</ul>';
    container.innerHTML = html;
    container.querySelectorAll('button[data-action]').forEach(function(btn){
      btn.addEventListener('click', function(ev){
        var slotId = ev.currentTarget.getAttribute('data-slot-id');
        var action = ev.currentTarget.getAttribute('data-action');
        updateSlotStatus(side, slotId, action === 'accept' ? 'accepted' : 'declined');
      });
    });
  }

  function updateSlotStatus(side, slotId, status){
    if(!slotId || !plannerState[side]) return;
    var slots = plannerState[side].slots || [];
    for(var i=0;i<slots.length;i++){
      if(slots[i].id === slotId){
        if(slots[i].status === status){
          slots[i].status = 'pending';
        } else {
          slots[i].status = status;
        }
        break;
      }
    }
    renderPlannerSlots(side);
    updateLink();
  }

  function syncPlannerInputs(){
    var couple = plannerState.couple || {};
    var photographer = plannerState.photographer || {};
    var el;
    el = document.getElementById('sp-couple-email'); if(el) el.value = couple.email || '';
    el = document.getElementById('sp-couple-notes'); if(el) el.value = couple.notes || '';
    el = document.getElementById('sp-photographer-email'); if(el) el.value = photographer.email || '';
    el = document.getElementById('sp-photographer-notes'); if(el) el.value = photographer.notes || '';
    renderPlannerSlots('couple');
    renderPlannerSlots('photographer');
  }

  function plannerSlotsPayload(slots){
    return (Array.isArray(slots)?slots:[]).map(function(slot){
      var normalized = normalizeSlot(slot);
      if(!normalized) return null;
      return {
        id: normalized.id,
        date: normalized.date,
        time: normalized.time,
        status: normalized.status
      };
    }).filter(Boolean);
  }

  function collectPlannerState(){
    return {
      couple: {
        email: (plannerState.couple.email || '').trim(),
        notes: (plannerState.couple.notes || '').trim(),
        slots: plannerSlotsPayload(plannerState.couple.slots)
      },
      photographer: {
        email: (plannerState.photographer.email || '').trim(),
        notes: (plannerState.photographer.notes || '').trim(),
        slots: plannerSlotsPayload(plannerState.photographer.slots)
      }
    };
  }

  function applyPlannerState(data){
    if(!data || typeof data !== 'object'){
      plannerState.couple = { email:'', notes:'', slots:[] };
      plannerState.photographer = { email:'', notes:'', slots:[] };
    } else {
      var c = data.couple || {};
      var p = data.photographer || {};
      plannerState.couple = {
        email: typeof c.email === 'string' ? c.email : '',
        notes: typeof c.notes === 'string' ? c.notes : '',
        slots: plannerSlotsPayload(c.slots)
      };
      plannerState.photographer = {
        email: typeof p.email === 'string' ? p.email : '',
        notes: typeof p.notes === 'string' ? p.notes : '',
        slots: plannerSlotsPayload(p.slots)
      };
    }
    syncPlannerInputs();
  }

  function addPlannerSlot(side, date, time){
    if(!plannerState[side]) return;
    var slot = normalizeSlot({ date:(date||'').trim(), time:(time||'').trim(), status:'pending' });
    plannerState[side].slots = plannerState[side].slots || [];
    plannerState[side].slots.push(slot);
    renderPlannerSlots(side);
    updateLink();
  }

  function validateEmail(email){
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function buildPlannerSummary(target){
    var state = collectPlannerState();
    var lines = [];
    if(target === 'photographer'){
      lines.push('Cześć!');
      lines.push('Młoda para zaktualizowała planer terminów w SunPlannerze.');
      if(state.couple.email){ lines.push('Kontakt do młodej pary: ' + state.couple.email); }
      if(state.couple.notes){ lines.push('Uwagi od młodej pary:\n' + state.couple.notes); }
    } else {
      lines.push('Cześć!');
      lines.push('Fotograf zaktualizował planer terminów w SunPlannerze.');
      if(state.photographer.email){ lines.push('Kontakt do fotografa: ' + state.photographer.email); }
      if(state.photographer.notes){ lines.push('Uwagi od fotografa:\n' + state.photographer.notes); }
    }
    lines.push('');
    lines.push('Propozycje młodej pary:');
    if(state.couple.slots.length){
      state.couple.slots.forEach(function(slot){
        lines.push('- ' + formatSlotLabel(slot) + ' (' + plannerStatusLabel(slot.status) + ')');
      });
    } else {
      lines.push('- brak terminów');
    }
    lines.push('');
    lines.push('Propozycje fotografa:');
    if(state.photographer.slots.length){
      state.photographer.slots.forEach(function(slot){
        lines.push('- ' + formatSlotLabel(slot) + ' (' + plannerStatusLabel(slot.status) + ')');
      });
    } else {
      lines.push('- brak terminów');
    }
    lines.push('');
    if(target === 'photographer' && state.photographer.notes){
      lines.push('Ostatnie uwagi fotografa:');
      lines.push(state.photographer.notes);
      lines.push('');
    }
    if(target === 'couple' && state.couple.notes){
      lines.push('Ostatnie uwagi młodej pary:');
      lines.push(state.couple.notes);
      lines.push('');
    }
    lines.push('Planer: ' + location.href);
    return lines.join('\n');
  }

  function sendPlannerNotification(target){
    if(!NOTIFY_URL){ toast('Powiadomienia e-mail są chwilowo niedostępne.'); return; }
    var state = collectPlannerState();
    var email = target === 'photographer' ? state.photographer.email : state.couple.email;
    if(!email){ toast('Podaj adres e-mail, aby wysłać powiadomienie.'); return; }
    if(!validateEmail(email)){ toast('Adres e-mail wygląda nieprawidłowo.'); return; }
    var statusEl = document.getElementById('sp-planner-status');
    if(statusEl) statusEl.textContent = 'Wysyłanie powiadomienia...';
    var payload = {
      target: target,
      email: email,
      subject: 'SunPlanner – nowe informacje w planerze sesji plenerowej',
      message: buildPlannerSummary(target)
    };
    fetch(NOTIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload)
    }).then(function(res){
      if(!res.ok){ throw new Error('http ' + res.status); }
      return res.json();
    }).then(function(){
      toast('Powiadomienie wysłane.', 'ok');
      if(statusEl){ statusEl.textContent = 'Powiadomienie wysłane na adres ' + email + '.'; }
    }).catch(function(){
      toast('Nie udało się wysłać powiadomienia.');
      if(statusEl){ statusEl.textContent = 'Błąd wysyłki powiadomienia.'; }
    });
  }

  // stan
  var map, geocoder, dirService, placesAutocomplete, dragMarker;
  var dirRenderers = [];
  var points = [];
  var driveMin = 0;
  var currentRoutes = [];
  var activeRouteIndex = 0;
  var sunDirectionLines = [];
  var forecastCache = {};
  var shortLinkValue = null;
  var lastSunData = {rise:null,set:null,lat:null,lng:null,label:'',date:null};
  var radarLayer = null, radarTemplate = null, radarFetchedAt = 0;

  var currentBands = null;

  var TPN_BOX = { lat:[49.15,49.30], lng:[19.73,20.26] };
  var TANAP_BOX = { lat:[49.08,49.28], lng:[19.70,20.45] };
  var MORSKIE_OKO_BOX = { lat:[49.17,49.22], lng:[20.02,20.12] };
  var GUBALOWKA_BOX = { lat:[49.29,49.33], lng:[19.88,19.98] };

  var LOCATION_ZONES = {
    tpn: {
      zoneLabel: 'Tatrzański Park Narodowy (TPN)',
      wedding: {
        paid: true,
        paymentHint: 'Zgłoszenia i opłaty prowadzi Tatrzański Park Narodowy (formularz online).',
        paymentUrl: 'https://tpn.pl/zwiedzaj/filmowanie-i-fotografowanie',
        paymentLabel: 'Formularz zgłoszenia TPN'
      },
      drone: {
        allowed: false,
        statusText: 'Zakaz lotów dronem',
        text: 'Loty dronem są zabronione na terenie TPN bez pisemnej zgody dyrektora parku. Zakaz dotyczy także przelotów nad obszarem parku startując spoza jego granic.'
      }
    },
    tanap: {
      zoneLabel: 'TANAP – Tatranský národný park (SK)',
      wedding: {
        paid: true,
        paymentHint: 'Zgłoszenia przyjmuje administracja TANAP – wniosek należy złożyć online.',
        paymentUrl: 'https://www.tanap.sk/ziadosti-a-povolenia/',
        paymentLabel: 'Wniosek TANAP'
      },
      drone: {
        allowed: false,
        statusText: 'Loty dronem ograniczone',
        text: 'W TANAP obowiązuje zakaz lotów dronem bez indywidualnej zgody TANAP oraz słowackiego urzędu lotnictwa. W strefie ochronnej praktycznie nie wydaje się pozwoleń.'
      }
    }
  };

  var LOCATION_PRESETS = [
    {
      id: 'morskie-oko',
      title: 'Morskie Oko',
      zone: 'tpn',
      zoneLabel: 'Morskie Oko – teren TPN',
      match: function(dest){
        if(!dest) return false;
        var label = normalizeLabel(dest.label||'');
        if(label.indexOf('morskie oko') !== -1) return true;
        return isWithinBox(dest.lat, dest.lng, MORSKIE_OKO_BOX);
      },
      crowd: {
        description: 'Największy tłok na szlaku i przy schronisku przypada między 10:00 a 14:00. Najspokojniej jest przed świtem lub po zachodzie słońca.',
        scaleNote: 'Skala 1–5 (5 = największy tłok na szlaku i przy schronisku).',
        maxLevel: 5,
        data: [
          {label:'05:00', level:1, tip:'Świt – bardzo spokojnie'},
          {label:'06:00', level:1, tip:'Pojedynczy turyści'},
          {label:'07:00', level:2, tip:'Pierwsze busy z Palenicy'},
          {label:'08:00', level:3, tip:'Ruch zaczyna rosnąć'},
          {label:'09:00', level:4, tip:'Duży napływ turystów'},
          {label:'10:00', level:5, tip:'Szczyt ruchu na podejściu i przy schronisku'},
          {label:'11:00', level:5, tip:'Tłum w okolicy jeziora'},
          {label:'13:00', level:4, tip:'Wciąż bardzo tłoczno'},
          {label:'15:00', level:3, tip:'Powroty turystów'},
          {label:'17:00', level:2, tip:'Stopniowo coraz luźniej'},
          {label:'19:00', level:1, tip:'Po zachodzie robi się pusto'}
        ]
      }
    },
    {
      id: 'gubalowka',
      title: 'Gubałówka',
      zoneLabel: 'Gubałówka – Zakopane',
      match: function(dest){
        if(!dest) return false;
        var label = normalizeLabel(dest.label||'');
        if(label.indexOf('gubalowka') !== -1) return true;
        return isWithinBox(dest.lat, dest.lng, GUBALOWKA_BOX);
      },
      wedding: {
        paid: false,
        paymentHint: 'W razie korzystania z infrastruktury PKL zgłoś się do obsługi kolejki lub właściciela terenu.'
      },
      drone: {
        allowed: false,
        statusText: 'Loty tylko za zgodą',
        text: 'Gubałówka znajduje się w strefie zabudowanej Zakopanego – lot wymaga zgody właściciela terenu i zgłoszenia w PAŻP. Latanie nad kolejką i tłumami jest zabronione.'
      },
      crowd: {
        description: 'Deptak przy górnej stacji kolejki zapełnia się od późnego ranka. Najspokojniej jest o świcie i po zachodzie słońca.',
        scaleNote: 'Skala 1–5 (5 = największy tłok przy górnej stacji).',
        maxLevel: 5,
        data: [
          {label:'07:00', level:1, tip:'Przed otwarciem sklepów'},
          {label:'08:00', level:2, tip:'Pierwsi turyści'},
          {label:'09:00', level:3, tip:'Ruch rośnie'},
          {label:'10:00', level:5, tip:'Pełne wagoniki kolejki'},
          {label:'11:00', level:5, tip:'Największy tłum na deptaku'},
          {label:'12:00', level:4, tip:'Stały wysoki ruch'},
          {label:'13:00', level:4, tip:'Popularny czas na zdjęcia'},
          {label:'14:00', level:5, tip:'Popołudniowy szczyt'},
          {label:'16:00', level:4, tip:'Powroty do Zakopanego'},
          {label:'18:00', level:2, tip:'Coraz luźniej'},
          {label:'20:00', level:1, tip:'Po zachodzie robi się spokojnie'}
        ]
      }
    }
  ];

  function isWithinBox(lat,lng,box){
    if(!box) return false;
    if(typeof lat!=='number' || typeof lng!=='number' || isNaN(lat) || isNaN(lng)) return false;
    return lat>=box.lat[0] && lat<=box.lat[1] && lng>=box.lng[0] && lng<=box.lng[1];
  }

  function makeLocationInsight(entry,dest){
    entry = entry || {};
    dest = dest || {};
    var zone = entry.zone && LOCATION_ZONES[entry.zone] ? LOCATION_ZONES[entry.zone] : null;
    var info = {
      title: entry.title || dest.label || '',
      zoneLabel: entry.zoneLabel || (zone && zone.zoneLabel) || ''
    };
    if(zone && zone.wedding){ info.wedding = Object.assign({}, zone.wedding); }
    if(zone && zone.drone){ info.drone = Object.assign({}, zone.drone); }
    if(entry.wedding){ info.wedding = Object.assign({}, info.wedding||{}, entry.wedding); }
    if(entry.drone){ info.drone = Object.assign({}, info.drone||{}, entry.drone); }
    if(entry.crowd){
      info.crowd = Object.assign({}, entry.crowd);
      if(entry.crowd.data){ info.crowd.data = entry.crowd.data.slice(); }
    }
    if(entry.description){ info.description = entry.description; }
    return info;
  }

  function computeLocationInsight(dest){
    if(!dest) return null;
    for(var i=0;i<LOCATION_PRESETS.length;i++){
      var preset=LOCATION_PRESETS[i];
      if(preset && typeof preset.match==='function' && preset.match(dest)){
        return makeLocationInsight(preset, dest);
      }
    }
    if(isWithinBox(dest.lat, dest.lng, TPN_BOX)){
      return makeLocationInsight({zone:'tpn', title: dest.label || 'Lokalizacja w TPN'}, dest);
    }
    if(isWithinBox(dest.lat, dest.lng, TANAP_BOX)){
      return makeLocationInsight({zone:'tanap', title: dest.label || 'Lokalizacja w TANAP'}, dest);
    }
    return null;
  }

  function updateLocationInsights(dest){
    var box=document.getElementById('sp-location-insights');
    if(!box){
      return;
    }
    dest = dest || points[points.length-1];
    if(!dest){
      box.innerHTML='<h3>Zasady na miejscu</h3><p class="muted">Dodaj cel podróży, aby sprawdzić zasady dla dronów.</p>';
      return;
    }
    var insight = computeLocationInsight(dest);
    if(!insight){
      box.innerHTML='<h3>Zasady na miejscu</h3><p class="muted">Brak danych dla tej lokalizacji. Sprawdź regulaminy zarządcy terenu.</p>';
      return;
    }
    var html='<h3>Zasady na miejscu</h3>';
    var drone=insight.drone;
    if(drone){
      var droneClass;
      if(drone.allowed===true){
        droneClass='location-insights__status location-insights__status--free';
      } else if(drone.allowed===false){
        droneClass='location-insights__status location-insights__status--restricted';
      } else {
        droneClass='location-insights__status location-insights__status--unknown';
      }
      var droneText=drone.statusText || (drone.allowed ? 'Loty dozwolone' : 'Zakaz lotów dronem');
      html+='<div class="location-insights__section"><h4>Drony</h4><div class="'+droneClass+'">'+escapeHtml(droneText)+'</div>';
      if(drone.text){
        html+='<p class="location-insights__note">'+escapeHtml(drone.text)+'</p>';
      }
      if(drone.url){
        var droneLabel=drone.linkLabel || 'Szczegóły przepisów';
        html+='<p class="location-insights__note"><a href="'+escapeHtml(drone.url)+'" target="_blank" rel="noopener">'+escapeHtml(droneLabel)+'</a></p>';
      }
      html+='</div>';
    } else {
      html+='<p class="muted">Brak danych o zasadach dla dronów.</p>';
    }
    box.innerHTML=html;
  }

  var RADAR_FALLBACKS = [
    'https://tilecache.rainviewer.com/v4/composite/latest/256/{z}/{x}/{y}/2/1_1.png',
    'https://tilecache.rainviewer.com/v3/radar/nowcast/latest/256/{z}/{x}/{y}/2/1_1.png',
    'https://tilecache.rainviewer.com/v3/radar/nowcast/latest/256/{z}/{x}/{y}/3/1_1.png',
    'https://tilecache.rainviewer.com/v2/radar/last/256/{z}/{x}/{y}/2/1_1.png'
  ];

  var restoredFromShare = false;
  var STORAGE_KEY = 'sunplanner-state';
  var storageAvailable = (function(){ try{return !!window.localStorage; }catch(e){ return false; } })();
  var routeColors = ['#e94244','#1e3a8a','#6b7280'];
  var pendingRadar = false;

  // data
  var today=new Date(), max=new Date(today); max.setDate(max.getDate()+16);
  var dEl = $('#sp-date');
  dEl.min=today.toISOString().split('T')[0]; dEl.max=max.toISOString().split('T')[0];
  dEl.value = dEl.value || today.toISOString().split('T')[0];

  function dateFromInput(iso){ var a=(iso||'').split('-'); return new Date(Date.UTC(+a[0],(+a[1]||1)-1,+a[2]||1,12,0,0)); }

  // link persist
  var b64url = {
    enc: function(obj){
      var json = JSON.stringify(obj);
      var utf8 = unescape(encodeURIComponent(json));
      var b = btoa(utf8).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
      return b;
    },
    dec: function(s){
      s = (s||'').replace(/-/g,'+').replace(/_/g,'/'); while(s.length%4)s+='=';
      var json = decodeURIComponent(escape(atob(s)));
      return JSON.parse(json);
    }
  };
  function packState(){
    var radarEl=$('#sp-radar');
    return {
      date:dEl.value,
      sr:$('#sp-slider-rise').value,
      ss:$('#sp-slider-set').value,
      rad: (radarEl && radarEl.checked)?1:0,
      pts:points.map(function(p){return {lat:+p.lat,lng:+p.lng,label:p.label||'Punkt'};}),
      planner: collectPlannerState()
    };
  }
  function unpackState(obj){
    if(!obj) return;
    if(obj.date) dEl.value=obj.date;
    if(obj.sr) $('#sp-slider-rise').value=obj.sr;
    if(obj.ss) $('#sp-slider-set').value=obj.ss;
    if(typeof obj.rad !== 'undefined'){ pendingRadar = !!obj.rad; }
    if(Object.prototype.toString.call(obj.pts)==='[object Array]'){
      points = obj.pts.map(function(p){ return {lat:+p.lat,lng:+p.lng,label:p.label||'Punkt'}; });
    }
    if(obj.planner){
      applyPlannerState(obj.planner);
    } else {
      applyPlannerState(null);
    }
  }
  function persistState(){ if(!storageAvailable) return; try{ window.localStorage.setItem(STORAGE_KEY, b64url.enc(packState())); }catch(e){} }
  (function(){
    var params=new URLSearchParams(location.search);
    var sp=params.get('sp');
    if(sp){
      try{ unpackState(b64url.dec(sp)); restoredFromShare=true; }
      catch(e){ console.warn('SP decode',e); }
    } else if(CFG.SHARED_SP){
      try{ unpackState(b64url.dec(CFG.SHARED_SP)); restoredFromShare=true; }
      catch(err){ console.warn('Share decode',err); }
    } else if(storageAvailable){
      try{
        var saved=window.localStorage.getItem(STORAGE_KEY);
        if(saved){ unpackState(b64url.dec(saved)); }
      }catch(e){ }
    }
  })();
  updateLocationInsights();

  // SunCalc lite (fallback)
  var SunCalcLite=(function(){
    var PI=Math.PI, R=PI/180, DAY=86400000;
    var e=23.4397*R;
    function M(d){ return R*(357.5291+0.98560028*d); }
    function L(m){ var C=R*(1.9148*Math.sin(m)+.02*Math.sin(2*m)+.0003*Math.sin(3*m)); return m+C+102.9372*R+PI; }
    function dec(Ls){ return Math.asin(Math.sin(Ls)*Math.sin(e)); }
    function H(h,phi,dc){ var v=(Math.sin(h)-Math.sin(phi)*Math.sin(dc))/(Math.cos(phi)*Math.cos(dc)); if(v<-1)v=-1; if(v>1)v=1; return Math.acos(v); }
    function cyc(d,lw){ return Math.round(d-0.0009-lw/(2*Math.PI)); }
    function approx(Ht,lw,n){ return 0.0009+(Ht+lw)/(2*Math.PI)+n; }
    function trJ(ds,m,l){ return 2451545+ds+0.0053*Math.sin(m)-0.0069*Math.sin(2*l); }
    function toJ(d){ return (Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())/DAY)-.5+2440587.5; }
    function fromJ(j){ return new Date((j+.5-2440587.5)*DAY); }
    function RA(l){ return Math.atan2(Math.sin(l)*Math.cos(e), Math.cos(l)); }
    function sidereal(d,lw){ return R*(280.16+360.9856235*d)-lw; }
    function alt(Ht,phi,dc){ return Math.asin(Math.sin(phi)*Math.sin(dc)+Math.cos(phi)*Math.cos(dc)*Math.cos(Ht)); }
    function az(Ht,phi,dc){ return Math.atan2(Math.sin(Ht), Math.cos(Ht)*Math.sin(phi)-Math.tan(dc)*Math.cos(phi)); }
    var HZ={sunrise:-0.833*R, civil:-6*R, goldUp:6*R};
    function getTimes(date,lat,lng){
      var lw=-lng*R, phi=lat*R, d=toJ(date)-2451545, n=cyc(d,lw), ds=approx(0,lw,n);
      var m=M(ds), l=L(m), dc=dec(l);
      function RS(h){ var w=H(h,phi,dc); return {rise:trJ(approx(-w,lw,n),m,l), set:trJ(approx(w,lw,n),m,l)}; }
      var base=RS(HZ.sunrise), civ=RS(HZ.civil), gup=RS(HZ.goldUp);
      return {
        sunrise:fromJ(base.rise), sunset:fromJ(base.set),
        civilDawn:fromJ(civ.rise), civilDusk:fromJ(civ.set),
        goldenHourEnd:fromJ(gup.rise), goldenHour:fromJ(gup.set)
      };
    }
    function getPosition(date,lat,lng){
      var lw=-lng*R, phi=lat*R, d=toJ(date)-2451545;
      var m=M(d), l=L(m), dc=dec(l), ra=RA(l);
      var Ht=sidereal(d,lw)-ra;
      return { azimuth:az(Ht,phi,dc), altitude:alt(Ht,phi,dc) };
    }
    return { getTimes:getTimes, getPosition:getPosition };
  })();
  var SunCalc = (window.SunCalc && window.SunCalc.getTimes && window.SunCalc.getPosition) ? window.SunCalc : SunCalcLite;

  function bands(lat,lng,date){
    var t=SunCalc.getTimes(date,lat,lng);
    function pair(a,b){ return a<=b?[a,b]:[b,a]; }
    return {
      goldAM: pair(t.sunrise,    t.goldenHourEnd),
      goldPM: pair(t.goldenHour, t.sunset),
      blueAM: pair(t.civilDawn,  t.sunrise),
      bluePM: pair(t.sunset,     t.civilDusk)
    };
  }

  function applyBands(b){

    currentBands = b || null;

    function line(label, range){
      if(range && isValidDate(range[0]) && isValidDate(range[1])){
        return label + fmt(range[0])+'–'+fmt(range[1]);
      }
      return label + '— —';
    }
    setText('sp-gold-am', line('☀️ Poranna złota godzina: ', b && b.goldAM));
    setText('sp-blue-am', line('🌌 Poranna niebieska godzina: ', b && b.blueAM));
    setText('sp-gold-pm', line('☀️ Wieczorna złota godzina: ', b && b.goldPM));
    setText('sp-blue-pm', line('🌌 Wieczorna niebieska godzina: ', b && b.bluePM));
  }

  function deriveBandsFromSun(sunrise,sunset){
    if(!isValidDate(sunrise) || !isValidDate(sunset)) return null;
    var GOLD=60, BLUE=35;
    function rng(a,b){ if(!isValidDate(a) || !isValidDate(b)) return null; return a<=b?[a,b]:[b,a]; }
    return {
      goldAM: rng(sunrise, addMinutes(sunrise, GOLD)),
      goldPM: rng(addMinutes(sunset, -GOLD), sunset),
      blueAM: rng(addMinutes(sunrise, -BLUE), sunrise),
      bluePM: rng(sunset, addMinutes(sunset, BLUE))
    };
  }

  // lista
  function renderList(){
    var box=$('#sp-list'); box.innerHTML='';
    points.forEach(function(p,i){
      var row=document.createElement('div'); row.className='waypoint';
      var lab=document.createElement('div'); lab.textContent=(i+1)+'. '+(p.label||'Punkt');
      var ctr=document.createElement('div');
      function mk(txt,fn){ var b=document.createElement('button'); b.className='btn ghost'; b.textContent=txt; b.onclick=fn; return b; }
      ctr.appendChild(mk('↑',function(){ if(i>0){ var tmp=points[i-1]; points[i-1]=points[i]; points[i]=tmp; renderList(); recalcRoute(false); updateDerived(); } }));
      ctr.appendChild(mk('↓',function(){ if(i<points.length-1){ var tmp=points[i+1]; points[i+1]=points[i]; points[i]=tmp; renderList(); recalcRoute(false); updateDerived(); } }));
      ctr.appendChild(mk('×',function(){ points.splice(i,1); renderList(); recalcRoute(false); updateDerived(); }));
      row.appendChild(lab); row.appendChild(ctr); box.appendChild(row);
    });
  }
  function routeMetrics(route){
    var legs=(route && route.legs)?route.legs:[];
    var dist=legs.reduce(function(a,l){return a+(l.distance?l.distance.value:0);},0);
    var dura=legs.reduce(function(a,l){return a+(l.duration?l.duration.value:0);},0);
    return {
      distanceKm: dist/1000,
      durationSec: dura,
      driveMin: Math.round(dura/60),
      summary: (route && route.summary) ? route.summary : ''
    };
  }
  function renderRouteOptions(){
    var box=$('#sp-route-choices'); if(!box) return;
    box.innerHTML='';
    if(!currentRoutes.length){
      var msg=document.createElement('div'); msg.className='muted';
      msg.textContent='Dodaj co najmniej dwa punkty, aby zobaczyć trasy.';
      box.appendChild(msg);
      return;
    }
    currentRoutes.forEach(function(route,idx){
      var metrics=routeMetrics(route);
      var btn=document.createElement('button');
      btn.type='button';
      btn.className='route-option'+(idx===activeRouteIndex?' active':'');
      var title=metrics.summary||('Trasa '+(idx+1));
      var min=Math.round(metrics.durationSec/60);
      var h=Math.floor(min/60), m=min%60;
      var strong=document.createElement('strong'); strong.textContent=title;
      var span=document.createElement('span'); span.textContent=metrics.distanceKm?metrics.distanceKm.toFixed(1)+' km':'—';
      var small=document.createElement('small'); small.textContent=(h? h+' h ':'')+m+' min';
      btn.appendChild(strong); btn.appendChild(span); btn.appendChild(small);
      btn.onclick=function(){ setActiveRoute(idx); };
      box.appendChild(btn);
    });
  }
  function refreshRendererStyles(){
    dirRenderers.forEach(function(renderer,i){
      if(!renderer || !renderer.setOptions) return;
      var baseColor=routeColors[i] || routeColors[routeColors.length-1];
      renderer.setOptions({
        polylineOptions:{
          strokeColor:baseColor,
          strokeWeight:[6,5,4][i]||4,
          strokeOpacity: i===activeRouteIndex ? 0.95 : 0.35
        },
        suppressMarkers:i>0,
        preserveViewport:i>0
      });
    });
  }
  function setActiveRoute(idx,skipSun){
    if(typeof idx!=='number' || idx<0 || idx>=currentRoutes.length){ return; }
    activeRouteIndex=idx;
    refreshRendererStyles();
    var route=currentRoutes[idx];
    var metrics=routeMetrics(route);
    if(metrics.distanceKm){ setText('sp-t-dist', metrics.distanceKm.toFixed(1)+' km'); }
    else setText('sp-t-dist','—');
    var min=Math.round(metrics.durationSec/60);
    var h=Math.floor(min/60), m=min%60;
    setText('sp-t-time', (h? h+' h ':'')+m+' min');
    driveMin=metrics.driveMin;
    renderRouteOptions();
    if(!skipSun) updateSunWeather();
  }
  function updateDerived(){
    var dest=points[points.length-1];
    setText('sp-loc', dest ? (dest.label || (dest.lat.toFixed(4)+','+dest.lng.toFixed(4))) : '—');
    setText('sp-date-label', dEl.value || '—');
    updateLocationInsights(dest);
    updateLink();
  }

  // geocode
  var placesService;
  function geocode(text){
    return new Promise(function(resolve,reject){
      if(!geocoder || !map){ reject(new Error('mapa niegotowa')); return; }
      geocoder.geocode({address:text},function(res,st){
        if(st==='OK' && res[0]){
          var loc=res[0].geometry.location;
          resolve({lat:loc.lat(),lng:loc.lng(),label:res[0].formatted_address});
        } else {
          if(!placesService) placesService = new google.maps.places.PlacesService(map);
          placesService.textSearch({query:text},function(r2,st2){
            if(st2==='OK' && r2[0]){
              var loc=r2[0].geometry.location;
              resolve({lat:loc.lat(),lng:loc.lng(),label:r2[0].name});
            } else reject(new Error('Nie znaleziono'));
          });
        }
      });
    });
  }

  // trasy
  function clearRenderers(){ dirRenderers.forEach(function(r){ if(r && r.setMap) r.setMap(null); }); dirRenderers=[]; }
  function recalcRoute(optimize){
    setText('sp-t-dist','—'); setText('sp-t-time','—');
    clearRenderers();
    currentRoutes=[]; activeRouteIndex=0; renderRouteOptions(); refreshRendererStyles();
    if(!map || points.length<2){ driveMin=0; updateSunWeather(); return; }

    var origin = new google.maps.LatLng(points[0].lat, points[0].lng);
    var destination = new google.maps.LatLng(points[points.length-1].lat, points[points.length-1].lng);
    var hasWps = points.length>2;
    var wps = hasWps ? points.slice(1,-1).map(function(p){ return {location:new google.maps.LatLng(p.lat,p.lng),stopover:true}; }) : [];

    var baseReq = {origin:origin, destination:destination, waypoints:wps, optimizeWaypoints: (!!optimize && hasWps), travelMode: google.maps.TravelMode.DRIVING};

    var tasks=[];
    if(!hasWps){
      tasks.push(new Promise(function(res){ dirService.route(Object.assign({},baseReq,{provideRouteAlternatives:true}),function(r,s){ res(s==='OK'?r:null); }); }));
    } else {
      tasks.push(new Promise(function(res){ dirService.route(baseReq,function(r,s){ res(s==='OK'?r:null); }); }));
      tasks.push(new Promise(function(res){ dirService.route(Object.assign({},baseReq,{avoidTolls:true}),function(r,s){ res(s==='OK'?r:null); }); }));
      tasks.push(new Promise(function(res){ dirService.route(Object.assign({},baseReq,{avoidHighways:true}),function(r,s){ res(s==='OK'?r:null); }); }));
    }

    Promise.all(tasks).then(function(results){
      var valid = results.filter(function(x){return !!x;});
      if(!valid.length){ toast('Trasa niedostępna'); driveMin=0; currentRoutes=[]; renderRouteOptions(); updateSunWeather(); return; }
      var routes=[];
      if(!hasWps){
        routes = (valid[0] && valid[0].routes) ? valid[0].routes.slice(0,3) : [];
        routes.forEach(function(_,idx){
          var ren=new google.maps.DirectionsRenderer({
            map:map, directions: valid[0], routeIndex: idx,
            polylineOptions: { strokeColor: routeColors[idx]||routeColors[routeColors.length-1], strokeWeight: [6,5,4][idx]||4, strokeOpacity:0.95 },
            suppressMarkers: idx>0, preserveViewport: idx>0
          });
          dirRenderers.push(ren);
        });
        currentRoutes = routes;
      } else {
        currentRoutes = [];
        valid.slice(0,3).forEach(function(res,idx){
          if(!res || !res.routes || !res.routes[0]) return;
          currentRoutes.push(res.routes[0]);
          var ren=new google.maps.DirectionsRenderer({
            map:map, directions: res, routeIndex: 0,
            polylineOptions:{ strokeColor: routeColors[idx]||routeColors[routeColors.length-1], strokeWeight:[6,5,4][idx]||4, strokeOpacity:0.95 },
            suppressMarkers: idx>0, preserveViewport: idx>0
          });
          dirRenderers.push(ren);
        });
      }

      if(!currentRoutes.length){ toast('Trasa niedostępna'); driveMin=0; renderRouteOptions(); updateSunWeather(); return; }
      activeRouteIndex=0;
      setActiveRoute(0,true);
      refreshRendererStyles();
      updateSunWeather();
    }).catch(function(){ toast('Trasa niedostępna'); driveMin=0; currentRoutes=[]; renderRouteOptions(); updateSunWeather(); });
  }

  // pogoda + slonce
  var RISE_OFF=90, SET_OFF=120;
  function parseLocalISO(iso){ if(!iso) return null; var sp=iso.split('T'); var d=sp[0].split('-'); var t=(sp[1]||'00:00').slice(0,5).split(':'); return new Date(+d[0],+d[1]-1,+d[2],+t[0]||0,+t[1]||0,0,0); }
  function closestHourIndex(hourly,when){
    if(!hourly || !hourly.time || !hourly.time.length || !(when instanceof Date)) return -1;
    var best=0,b=1e15;
    for(var i=0;i<hourly.time.length;i++){
      var dt=parseLocalISO(hourly.time[i]); if(!dt) continue;
      var diff=Math.abs(dt-when); if(diff<b){b=diff;best=i;}
    }
    return best;
  }
  function fillCardTimes(pref, sun, offMin, hours){
    if(!(sun instanceof Date) || isNaN(sun)){ ['sun','start','wake','bed'].forEach(function(k){ setText('sp-'+pref+'-'+k,'—'); }); return; }
    var start=new Date(sun - offMin*60000);
    var depart=new Date(start - (driveMin||0)*60000);
    var wake=new Date(depart - 30*60000);
    var bed =new Date(wake - hours*3600000);
    setText('sp-'+pref+'-sun', fmt(sun));
    setText('sp-'+pref+'-start', fmt(start));
    setText('sp-'+pref+'-wake', fmt(wake));
    setText('sp-'+pref+'-bed', fmt(bed));
  }
  function setWeatherOnly(pref, hourly, when){
    if(!hourly || !hourly.time || !hourly.time.length || !(when instanceof Date)) return;
    var idx=closestHourIndex(hourly, when);
    function pick(arr){ return (arr && typeof arr[idx] !== 'undefined') ? arr[idx] : null; }
    var t=pick(hourly.temperature_2m), c=pick(hourly.cloudcover), w=pick(hourly.wind_speed_10m), h=pick(hourly.relative_humidity_2m), v=pick(hourly.visibility), p=pick(hourly.precipitation);
    setText('sp-'+pref+'-t', t!=null?Math.round(t)+'°C':'—');
    setText('sp-'+pref+'-c', c!=null?Math.round(c)+'%':'—');
    setText('sp-'+pref+'-w', w!=null?Math.round(w)+' km/h':'—');
    setText('sp-'+pref+'-h', h!=null?Math.round(h)+'%':'—');
    setText('sp-'+pref+'-v', v!=null?Math.round(v/1000)+' km':'—');
    setText('sp-'+pref+'-p', p!=null?Number(p).toFixed(1)+' mm':'—');
  }
  function clearWeatherPanels(){
    ['rise','set'].forEach(function(pref){
      ['t','c','w','h','v','p'].forEach(function(k){ setText('sp-'+pref+'-'+k,'—'); });
    });
  }
  function prepareCanvas(canvas){
    if(!canvas) return null;
    var ctx=canvas.getContext('2d'); if(!ctx) return null;
    var width=canvas.clientWidth||canvas.width||320;
    var height=canvas.clientHeight||canvas.height||160;
    var ratio=window.devicePixelRatio||1;
    canvas.width=width*ratio;
    canvas.height=height*ratio;
    ctx.setTransform(ratio,0,0,ratio,0,0);
    ctx.clearRect(0,0,width,height);
    return {ctx:ctx,width:width,height:height};
  }
  function renderHourlyChart(hourly,dateStr,loading){
    var canvas=document.getElementById('sp-hourly');
    if(!canvas) return;
    var prep=prepareCanvas(canvas); if(!prep) return;
    var ctx=prep.ctx, width=prep.width, height=prep.height;
    ctx.fillStyle='#f9fafb';
    ctx.fillRect(0,0,width,height);
    ctx.font='12px system-ui, sans-serif';
    ctx.fillStyle='#9ca3af';
    var leftPad=16;
    var axisX=Math.min(width-30, Math.max(leftPad+60,width-48));
    var chartWidth=Math.max(10,axisX-leftPad-12);
    var bottom=height-28;
    var chartHeight=height*0.55;
    var barArea=height*0.28;
    if(loading){ ctx.fillText('Ładowanie prognozy...',leftPad,height/2); return; }
    if(!hourly || !hourly.time || !hourly.time.length){ ctx.fillText('Brak danych pogodowych.',leftPad,height/2); return; }
    var points=[];
    for(var i=0;i<hourly.time.length;i++){
      var dt=parseLocalISO(hourly.time[i]);
      if(!dt) continue;
      var day=dt.toISOString().slice(0,10);
      if(dateStr && day!==dateStr) continue;
      var temp=(hourly.temperature_2m && typeof hourly.temperature_2m[i] === 'number') ? hourly.temperature_2m[i] : null;
      var prec=(hourly.precipitation && typeof hourly.precipitation[i] === 'number') ? hourly.precipitation[i] : 0;
      points.push({time:dt,temp:temp,prec:prec});
    }
    if(!points.length){ ctx.fillText('Brak danych dla wybranego dnia.',leftPad,height/2); return; }
    var minTemp=Infinity,maxTemp=-Infinity,maxPrec=0;
    points.forEach(function(p){
      if(p.temp!=null){ if(p.temp<minTemp) minTemp=p.temp; if(p.temp>maxTemp) maxTemp=p.temp; }
      if(p.prec>maxPrec) maxPrec=p.prec;
    });
    if(minTemp===Infinity){ minTemp=0; maxTemp=0; }
    if(maxTemp-minTemp<4){ var adj=(4-(maxTemp-minTemp))/2; minTemp-=adj; maxTemp+=adj; }
    var range=(maxTemp-minTemp)||1;
    var axisTop=bottom-barArea;
    function formatPrec(val){
      var num=Math.max(0,Number(val||0));
      var decimals=num>=1?1:2;
      var txt=num.toFixed(decimals);
      txt=txt.replace(/\.0+$/,'').replace(/(\.\d*[1-9])0+$/,'$1');
      return txt;
    }
    function barColor(v){
      if(v>=2) return 'rgba(30,64,175,0.88)';
      if(v>=0.6) return 'rgba(96,165,250,0.85)';
      if(v>0) return 'rgba(199,210,254,0.85)';
      return null;
    }
    var tickMax=maxPrec>0?Math.max(0.5,Math.ceil(maxPrec*2)/2):0;
    ctx.strokeStyle='#ef4444';
    ctx.lineWidth=2;
    ctx.beginPath();
    points.forEach(function(p,idx){
      var x=leftPad+(idx/(points.length-1||1))*chartWidth;
      var tempVal=p.temp!=null?p.temp:minTemp;
      var y=bottom-((tempVal-minTemp)/range)*chartHeight;
      if(idx===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();
    var rightEdge=leftPad+chartWidth;
    ctx.lineTo(rightEdge,bottom);
    ctx.lineTo(leftPad,bottom);
    ctx.closePath();
    ctx.fillStyle='rgba(239,68,68,0.12)';
    ctx.fill();

    if(tickMax>0){
      ctx.strokeStyle='rgba(148,163,184,0.3)';
      ctx.lineWidth=1;
      ctx.setLineDash([4,6]);
      for(var t=1;t<=4;t++){
        var val=(tickMax/4)*t;
        var y=bottom-(val/tickMax)*barArea;
        ctx.beginPath();
        ctx.moveTo(leftPad,y);
        ctx.lineTo(axisX,y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.strokeStyle='rgba(148,163,184,0.6)';
      ctx.beginPath();
      ctx.moveTo(axisX,bottom);
      ctx.lineTo(axisX,axisTop);
      ctx.stroke();
      ctx.fillStyle='#1f2937';
      ctx.font='10px system-ui, sans-serif';
      for(var tick=0;tick<=4;tick++){
        var val2=(tickMax/4)*tick;
        var y2=bottom-(val2/tickMax)*barArea;
        ctx.fillText(formatPrec(val2)+' mm',axisX+6,y2+3);
      }

      points.forEach(function(p,idx){
        if(!p.prec) return;
        var fill=barColor(p.prec); if(!fill) return;
        var x=leftPad+(idx/(points.length-1||1))*chartWidth;
        var ratio=Math.min(1,p.prec/tickMax);
        var barHeight=Math.max(3,ratio*barArea);
        ctx.fillStyle=fill;
        ctx.fillRect(x-6,bottom-barHeight,12,barHeight);
        if(p.prec>=0.1){
          var label=formatPrec(p.prec)+' mm';
          var maxLabelX=Math.max(leftPad,rightEdge-36);
          var textX=Math.min(maxLabelX,Math.max(leftPad,x-16));
          ctx.fillStyle='#1e3a8a';
          ctx.font='10px system-ui, sans-serif';
          ctx.fillText(label,textX,bottom-barHeight-6);
        }
      });
    }

    ctx.fillStyle='#374151';
    ctx.font='11px system-ui, sans-serif';
    points.forEach(function(p,idx){
      if(idx%3!==0 && idx!==points.length-1) return;
      var x=leftPad+(idx/(points.length-1||1))*chartWidth;
      var lbl=p.time.toLocaleTimeString('pl-PL',{hour:'2-digit'});
      var maxTimeX=Math.max(leftPad,rightEdge-24);
      var textX=Math.min(maxTimeX,Math.max(leftPad,x-12));
      ctx.fillText(lbl,textX,height-6);
    });
    ctx.fillText(Math.round(maxTemp)+'°C',leftPad+4,bottom-chartHeight-10);
    ctx.fillText(Math.round(minTemp)+'°C',leftPad+4,bottom-6);

  }
  function renderSunshineChart(hourly,dateStr,loading){
    var canvas=document.getElementById('sp-sunshine');
    if(!canvas) return;
    var prep=prepareCanvas(canvas); if(!prep) return;
    var ctx=prep.ctx, width=prep.width, height=prep.height;
    ctx.fillStyle='#fffbeb';
    ctx.fillRect(0,0,width,height);
    ctx.font='12px system-ui, sans-serif';
    ctx.fillStyle='#b45309';
    var leftPad=16;
    var rightPad=16;
    var chartWidth=Math.max(10,width-leftPad-rightPad);
    var bottom=height-28;
    var chartHeight=Math.max(40,height-56);
    var top=bottom-chartHeight;
    if(loading){ ctx.fillText('Ładowanie danych o słońcu...',leftPad,height/2); return; }
    if(!hourly || !hourly.time || !hourly.time.length){ ctx.fillText('Brak danych o nasłonecznieniu.',leftPad,height/2); return; }
    var points=[];
    for(var i=0;i<hourly.time.length;i++){
      var dt=parseLocalISO(hourly.time[i]);
      if(!dt) continue;
      var day=dt.toISOString().slice(0,10);
      if(dateStr && day!==dateStr) continue;
      var dur=(hourly.sunshine_duration && typeof hourly.sunshine_duration[i] === 'number') ? hourly.sunshine_duration[i] : null;
      if(dur==null) continue;
      var minutes=Math.max(0,dur/60);
      points.push({time:dt,minutes:minutes});
    }
    if(!points.length){ ctx.fillText('Brak danych o nasłonecznieniu dla wybranego dnia.',leftPad,height/2); return; }
    points.sort(function(a,b){ return a.time-b.time; });
    var maxMinutes=points.reduce(function(max,p){ return p.minutes>max?p.minutes:max; },0);
    var scale=Math.max(60, Math.ceil((maxMinutes||0)/10)*10);
    if(scale<60) scale=60;
    if(scale>180) scale=180;
    var start=points[0].time.getTime();
    var end=points[points.length-1].time.getTime();
    if(end<=start) end=start+3600000;
    function xForDate(date){
      if(!(date instanceof Date) || isNaN(date)) return null;
      var ratio=(date.getTime()-start)/(end-start);
      ratio=Math.min(1,Math.max(0,ratio));
      return leftPad+ratio*chartWidth;
    }
    var sunrise=(lastSunData && lastSunData.rise instanceof Date && !isNaN(lastSunData.rise)) ? lastSunData.rise : null;
    var sunset =(lastSunData && lastSunData.set  instanceof Date && !isNaN(lastSunData.set )) ? lastSunData.set  : null;
    var xRise=xForDate(sunrise);
    var xSet =xForDate(sunset);
    if(xRise!=null && xSet!=null && xSet>xRise){
      ctx.fillStyle='rgba(253,224,71,0.18)';
      ctx.fillRect(xRise, top, Math.min(chartWidth, xSet-xRise), chartHeight);
      ctx.strokeStyle='rgba(217,119,6,0.45)';
      ctx.setLineDash([4,4]);
      ctx.beginPath();
      ctx.moveTo(xRise, top);
      ctx.lineTo(xRise, bottom);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(xSet, top);
      ctx.lineTo(xSet, bottom);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle='#b45309';
      ctx.font='10px system-ui, sans-serif';
      var dawnLabelX=Math.max(leftPad, Math.min(xRise-18, leftPad+chartWidth-36));
      var duskLabelX=Math.max(leftPad, Math.min(xSet-28, leftPad+chartWidth-36));
      ctx.fillText('Świt', dawnLabelX, top-6);
      ctx.fillText('Zachód', duskLabelX, top-6);
    }
    ctx.fillStyle='#b45309';
    ctx.font='11px system-ui, sans-serif';
    ctx.fillText('Minuty słońca (na godzinę)', leftPad, top-14);
    ctx.strokeStyle='rgba(217,119,6,0.25)';
    ctx.setLineDash([4,6]);
    for(var step=1;step<=3;step++){
      var ratio=step/3;
      var y=bottom-ratio*chartHeight;
      ctx.beginPath();
      ctx.moveTo(leftPad,y);
      ctx.lineTo(leftPad+chartWidth,y);
      ctx.stroke();
      ctx.fillStyle='#b45309';
      ctx.font='10px system-ui, sans-serif';
      ctx.fillText(Math.round(scale*ratio)+' min', leftPad, y-4);
    }
    ctx.setLineDash([]);
    ctx.strokeStyle='rgba(217,119,6,0.45)';
    ctx.lineWidth=1;
    ctx.beginPath();
    ctx.moveTo(leftPad, bottom);
    ctx.lineTo(leftPad+chartWidth, bottom);
    ctx.stroke();
    function sunshineColor(minutes){
      if(minutes>=50) return 'rgba(251,191,36,0.9)';
      if(minutes>=20) return 'rgba(253,224,71,0.88)';
      if(minutes>0) return 'rgba(254,243,199,0.9)';
      return 'rgba(226,232,240,0.8)';
    }
    var rightEdge=leftPad+chartWidth;
    var denom=(points.length-1)||1;
    var barWidth=Math.min(28, Math.max(10, chartWidth/(points.length*1.6)));
    points.forEach(function(p,idx){
      var x=leftPad+(idx/denom)*chartWidth;
      var minutes=p.minutes;
      var ratio=Math.min(1,minutes/scale);
      var barHeight=Math.max(2,ratio*chartHeight);
      ctx.fillStyle=sunshineColor(minutes);
      ctx.fillRect(x-barWidth/2,bottom-barHeight,barWidth,barHeight);
      if(minutes>=5){
        var label=Math.round(minutes)+' min';
        ctx.fillStyle='#92400e';
        ctx.font='10px system-ui, sans-serif';
        var textWidth=ctx.measureText(label).width;
        var textX=Math.max(leftPad, Math.min(rightEdge-textWidth, x-textWidth/2));
        ctx.fillText(label,textX,bottom-barHeight-6);
      } else if(minutes<1){
        ctx.fillStyle='rgba(148,163,184,0.6)';
        ctx.beginPath();
        ctx.arc(x,bottom-4,2,0,Math.PI*2);
        ctx.fill();
      }
    });
    ctx.fillStyle='#b45309';
    ctx.font='11px system-ui, sans-serif';
    points.forEach(function(p,idx){
      if(idx%2!==0 && idx!==points.length-1) return;
      var x=leftPad+(idx/denom)*chartWidth;
      var lbl=p.time.toLocaleTimeString('pl-PL',{hour:'2-digit'});
      var textWidth=ctx.measureText(lbl).width;
      var textX=Math.max(leftPad, Math.min(rightEdge-textWidth, x-textWidth/2));
      ctx.fillText(lbl,textX,height-6);
    });
  }
  function clamp(val,min,max){ if(typeof val!=='number' || isNaN(val)) return min; return Math.min(max,Math.max(min,val)); }
  function average(arr){ if(!arr || !arr.length) return null; var sum=0,count=0; arr.forEach(function(v){ if(typeof v==='number' && !isNaN(v)){ sum+=v; count++; } }); return count?sum/count:null; }
  function evaluateHourScore(temp,cloud,prec){
    var score=50;
    var rain=Math.max(0,(typeof prec==='number' && !isNaN(prec))?prec:0);
    if(rain===0) score+=25;
    else if(rain<0.2) score+=18;
    else if(rain<0.6) score+=8;
    else if(rain<1.2) score-=6;
    else score-=16;
    var c=(typeof cloud==='number' && !isNaN(cloud))?cloud:50;
    if(c<=20) score+=18;
    else if(c<=40) score+=25;
    else if(c<=60) score+=18;
    else if(c<=75) score+=6;
    else score-=8;
    if(typeof temp==='number' && !isNaN(temp)){
      if(temp>=10 && temp<=24) score+=12;
      else if(temp>=4 && temp<=28) score+=6;
      else score-=6;
    }
    return clamp(score,0,100);
  }
  function formatHourRange(start,end){
    if(!(start instanceof Date) || isNaN(start) || !(end instanceof Date) || isNaN(end)) return '—';
    var opts={hour:'2-digit',minute:'2-digit'};
    var startTxt=start.toLocaleTimeString('pl-PL',opts);
    var endTxt=end.toLocaleTimeString('pl-PL',opts);
    return startTxt+'–'+endTxt;
  }
  function describePrecipHourly(mm){
    if(!(typeof mm==='number') || isNaN(mm) || mm<=0) return 'bez opadów';
    if(mm<0.2) return 'symboliczne opady';
    if(mm<0.6) return 'przelotne opady';
    if(mm<1.5) return 'możliwy deszcz';
    return 'intensywny deszcz';
  }
  function describePrecipDaily(mm,prob){
    var rain=Math.max(0,(typeof mm==='number' && !isNaN(mm))?mm:0);
    var p=(typeof prob==='number' && !isNaN(prob))?prob:null;
    if(p!==null){
      if(p<=15 && rain<0.3) return 'sucho';
      if(p<=35 && rain<1) return 'mała szansa opadów';
      if(p<=60) return 'możliwe przelotne opady';
      if(p<=80) return 'częste opady';
      return 'wysokie ryzyko deszczu';
    }
    if(rain<0.3) return 'sucho';
    if(rain<1) return 'niewielkie opady';
    if(rain<3) return 'umiarkowane opady';
    return 'mokro';
  }
  function describeCloud(cloud){
    if(!(typeof cloud==='number') || isNaN(cloud)) return 'zmienne zachmurzenie';
    if(cloud<=15) return 'bezchmurnie';
    if(cloud<=35) return 'lekkie chmury';
    if(cloud<=65) return 'umiarkowane chmury';
    if(cloud<=80) return 'spore zachmurzenie';
    return 'pochmurno';
  }
  function describeTemp(temp){ if(!(typeof temp==='number') || isNaN(temp)) return ''; return 'ok. '+Math.round(temp)+'°C'; }
  function describeDailyTemp(min,max){
    if(!(typeof min==='number') || isNaN(min) || !(typeof max==='number') || isNaN(max)) return '';
    return 'temperatury '+Math.round(min)+'–'+Math.round(max)+'°C';
  }
  function isDaylightTime(time,sunrise,sunset){
    if(!(time instanceof Date) || isNaN(time)) return false;
    if(isValidDate(sunrise) && isValidDate(sunset)){
      var t=time.getTime();
      return t>=sunrise.getTime() && t<=sunset.getTime();
    }
    var hour=time.getHours();
    return hour>=7 && hour<=21;
  }
  function rangeIntersect(range,band){
    if(!range || !band || !(range.start instanceof Date) || !(range.end instanceof Date)) return false;
    if(!(band[0] instanceof Date) || !(band[1] instanceof Date)) return false;
    var a1=range.start.getTime(), a2=range.end.getTime();
    var b1=band[0].getTime(), b2=band[1].getTime();
    return a1 < b2 && b1 < a2;
  }
  function slotTag(range){
    var tags=[];
    if(currentBands){
      if(rangeIntersect(range,currentBands.goldAM)) tags.push('poranna złota godzina');
      if(rangeIntersect(range,currentBands.goldPM)) tags.push('wieczorna złota godzina');
      if(rangeIntersect(range,currentBands.blueAM)) tags.push('poranna niebieska godzina');
      if(rangeIntersect(range,currentBands.bluePM)) tags.push('wieczorna niebieska godzina');
    }
    if(!tags.length) return '';
    return ' '+tags.map(function(t){return '<span class="session-summary__tag">'+t+'</span>';}).join(' ');
  }
  function classifySessionScore(score,context){
    context=context||{};
    var allowIdeal=context.allowIdeal;
    if(typeof allowIdeal!=='boolean'){ allowIdeal=true; }
    if(score>=85 && allowIdeal) return {title:'Idealny dzień na plener', desc:'Światło i pogoda wyglądają znakomicie — możesz śmiało planować sesję.'};
    if(score>=70) return {title:'Bardzo dobry dzień', desc:'Prognozy sprzyjają zdjęciom w plenerze, wykorzystaj najlepsze okna czasowe.'};
    if(score>=55) return {title:'Dzień z dobrym potencjałem', desc:'Warunki powinny być korzystne, choć warto obserwować zmiany w prognozie.'};
    if(score>=40) return {title:'Wymagające warunki', desc:'Możliwe trudniejsze światło lub opady — przygotuj wariant awaryjny.'};
    return {title:'Trudne warunki do zdjęć', desc:'Prognozy wskazują spore ryzyko niekorzystnej pogody i światła.'};
  }
  function buildSlots(points,bestScore){
    var slots=[];
    var threshold=Math.max(55,bestScore-20);
    var current=null;
    points.forEach(function(p){
      if(p.score>=threshold){
        if(!current){ current={start:p.time,end:new Date(p.time.getTime()+3600000),temps:[],clouds:[],precs:[],scores:[]}; }
        current.end=new Date(p.time.getTime()+3600000);
        current.temps.push(p.temp);
        current.clouds.push(p.cloud);
        current.precs.push(p.prec);
        current.scores.push(p.score);
      } else if(current){
        slots.push(current);
        current=null;
      }
    });
    if(current) slots.push(current);
    if(!slots.length && points.length){
      var bestPoints=points.slice().sort(function(a,b){ return (b.score||0)-(a.score||0); }).slice(0,2);
      bestPoints.sort(function(a,b){ return a.time-b.time; });
      if(bestPoints.length){
        var s={start:bestPoints[0].time,end:new Date(bestPoints[bestPoints.length-1].time.getTime()+3600000),temps:[],clouds:[],precs:[],scores:[]};
        bestPoints.forEach(function(p){ s.temps.push(p.temp); s.clouds.push(p.cloud); s.precs.push(p.prec); s.scores.push(p.score); });
        slots.push(s);
      }
    }
    slots.forEach(function(s){ s.score=average(s.scores)||0; });
    slots.sort(function(a,b){ return (b.score||0)-(a.score||0); });
    return slots.slice(0,2);
  }
  function slotDescription(slot){
    if(!slot) return '';
    var avgTemp=average(slot.temps);
    var avgCloud=average(slot.clouds);
    var avgPrec=average(slot.precs);
    var parts=[describePrecipHourly(avgPrec), describeCloud(avgCloud)];
    var t=describeTemp(avgTemp); if(t) parts.push(t);
    var range={start:slot.start,end:slot.end};
    return formatHourRange(slot.start,slot.end)+' – '+parts.filter(Boolean).join(', ')+slotTag(range);
  }
  function evaluateDayScore(prob,rain,cloud,tmin,tmax){
    var score=100;
    if(typeof prob==='number' && !isNaN(prob)) score-=Math.min(60,prob*0.6);
    else score-=Math.min(40,Math.max(0,(typeof rain==='number' && !isNaN(rain))?rain:0)*8);
    var rainVal=Math.max(0,(typeof rain==='number' && !isNaN(rain))?rain:0);
    score-=Math.min(20,rainVal*5);
    var cloudVal=(typeof cloud==='number' && !isNaN(cloud))?cloud:55;
    score-=Math.min(25,Math.abs(cloudVal-45)*0.4);
    if(typeof tmin==='number' && !isNaN(tmin) && typeof tmax==='number' && !isNaN(tmax)){
      var mid=(tmin+tmax)/2;
      score-=Math.min(18,Math.abs(mid-18)*0.7);
    }
    return clamp(score,0,100);
  }
  function buildBestDaysHtml(daily){
    if(!daily || !daily.time || !daily.time.length) return '';
    var days=[];
    for(var i=0;i<daily.time.length && i<10;i++){
      var iso=daily.time[i];
      if(!iso) continue;
      var date=new Date(iso+'T12:00:00');
      var prob=daily.precipitation_probability_max && typeof daily.precipitation_probability_max[i] === 'number' ? daily.precipitation_probability_max[i] : null;
      var rain=daily.precipitation_sum && typeof daily.precipitation_sum[i] === 'number' ? daily.precipitation_sum[i] : null;
      var cloud=daily.cloudcover_mean && typeof daily.cloudcover_mean[i] === 'number' ? daily.cloudcover_mean[i] : null;
      var tmin=daily.temperature_2m_min && typeof daily.temperature_2m_min[i] === 'number' ? daily.temperature_2m_min[i] : null;
      var tmax=daily.temperature_2m_max && typeof daily.temperature_2m_max[i] === 'number' ? daily.temperature_2m_max[i] : null;
      var score=evaluateDayScore(prob,rain,cloud,tmin,tmax);
      var label=date.toLocaleDateString('pl-PL',{weekday:'short',day:'numeric',month:'short'});
      var descParts=[describePrecipDaily(rain,prob), describeCloud(cloud)];
      var tempDesc=describeDailyTemp(tmin,tmax); if(tempDesc) descParts.push(tempDesc);
      days.push({score:score,label:label,desc:descParts.filter(Boolean).join(', ')});
    }
    days.sort(function(a,b){ return (b.score||0)-(a.score||0); });
    var top=days.filter(function(d){ return d.score>=45; }).slice(0,3);
    if(!top.length) top=days.slice(0,3);
    if(!top.length) return '';
    var items=top.map(function(d){ return '<li><strong>'+d.label+'</strong> – '+d.desc+'</li>'; }).join('');
    return '<div class="session-summary__future"><strong>Najlepsze dni w ciągu 10 dni</strong><ul>'+items+'</ul></div>';
  }
  function renderSessionSummary(data,dateStr){
    if(!data){ sessionSummaryNoData(); return; }
    var points=[];
    var sunrise=(lastSunData && lastSunData.rise instanceof Date && !isNaN(lastSunData.rise)) ? lastSunData.rise : null;
    var sunset =(lastSunData && lastSunData.set  instanceof Date && !isNaN(lastSunData.set )) ? lastSunData.set  : null;
    if(data.hourly && Array.isArray(data.hourly.time)){
      for(var i=0;i<data.hourly.time.length;i++){
        var iso=data.hourly.time[i];
        if(!iso || (dateStr && iso.slice(0,10)!==dateStr)) continue;
        var time=parseLocalISO(iso);
        if(!(time instanceof Date) || isNaN(time)) continue;
        var temp=(data.hourly.temperature_2m && typeof data.hourly.temperature_2m[i] === 'number') ? data.hourly.temperature_2m[i] : null;
        var cloud=(data.hourly.cloudcover && typeof data.hourly.cloudcover[i] === 'number') ? data.hourly.cloudcover[i] : null;
        var prec=(data.hourly.precipitation && typeof data.hourly.precipitation[i] === 'number') ? data.hourly.precipitation[i] : 0;
        var sunshineSec=(data.hourly.sunshine_duration && typeof data.hourly.sunshine_duration[i] === 'number') ? data.hourly.sunshine_duration[i] : null;
        var sunshineMin=(typeof sunshineSec === 'number') ? sunshineSec/60 : null;
        var score=evaluateHourScore(temp,cloud,prec);
        points.push({time:time,temp:temp,cloud:cloud,prec:prec,score:score,sunshine:sunshineMin,isDaylight:isDaylightTime(time,sunrise,sunset)});
      }
    }
    var bestDaysHtml=buildBestDaysHtml(data.daily);
    if(!points.length){
      var baseHtml='<strong>Brak danych godzinowych</strong><span class="session-summary__lead">Nie udało się pobrać szczegółowej prognozy dla wybranej daty.</span>';
      if(bestDaysHtml) baseHtml+=bestDaysHtml;
      setSessionSummary(baseHtml);
      return;
    }
    var daylightPoints=points.filter(function(p){ return p.isDaylight; });
    var evaluationPoints=daylightPoints.length ? daylightPoints : points;
    var bestScore=0;
    evaluationPoints.forEach(function(p){ if(p.score>bestScore) bestScore=p.score; });

    var dayIndex=-1;
    if(data.daily && Array.isArray(data.daily.time)){
      dayIndex=data.daily.time.indexOf(dateStr);
    }
    var dailyRain=(dayIndex>=0 && data.daily && Array.isArray(data.daily.precipitation_sum) && typeof data.daily.precipitation_sum[dayIndex] === 'number') ? data.daily.precipitation_sum[dayIndex] : null;
    var dailyProb=(dayIndex>=0 && data.daily && Array.isArray(data.daily.precipitation_probability_max) && typeof data.daily.precipitation_probability_max[dayIndex] === 'number') ? data.daily.precipitation_probability_max[dayIndex] : null;
    var rainExpected=evaluationPoints.some(function(p){ return typeof p.prec==='number' && p.prec>=0.2; });
    if(!rainExpected && typeof dailyRain==='number' && dailyRain>0.5) rainExpected=true;
    if(!rainExpected && typeof dailyProb==='number' && dailyProb>=50) rainExpected=true;

    var totalSunshine=0;
    daylightPoints.forEach(function(p){ if(typeof p.sunshine==='number' && !isNaN(p.sunshine)) totalSunshine+=p.sunshine; });
    var hasSunshine=daylightPoints.length>0 && totalSunshine>=20;
    if(!hasSunshine && daylightPoints.length){
      hasSunshine=daylightPoints.some(function(p){ return typeof p.cloud==='number' && p.cloud<=55; });
    }

    var rating=classifySessionScore(bestScore,{allowIdeal: hasSunshine && !rainExpected});
    var slotsHtml='';
    if(daylightPoints.length){
      var slots=buildSlots(daylightPoints,bestScore);
      if(slots.length){
        slotsHtml='<div class="session-summary__slots">'+slots.map(function(s){ return '<span>'+slotDescription(s)+'</span>'; }).join('')+'</div>';
      } else {
        slotsHtml='<div class="session-summary__slots"><span>Brak wyraźnie dobrego okna — przygotuj alternatywę lub obserwuj zmiany.</span></div>';
      }
    } else {
      slotsHtml='<div class="session-summary__slots"><span>Brak jasnych godzin – poczekaj na światło dzienne.</span></div>';
    }
    var html='<strong>'+rating.title+'</strong><span class="session-summary__lead">'+rating.desc+'</span>'+slotsHtml;
    if(bestDaysHtml) html+=bestDaysHtml;
    setSessionSummary(html);

  }
  function setSunMeta(dest,sunrise,sunset){
    var riseAz=null, setAz=null;
    if(dest && typeof dest.lat==='number' && typeof dest.lng==='number'){
      if(sunrise instanceof Date && !isNaN(sunrise)){ var posR=SunCalc.getPosition(sunrise,dest.lat,dest.lng); if(posR && typeof posR.azimuth==='number') riseAz=Math.round(bearingFromAzimuth(posR.azimuth)); }
      if(sunset instanceof Date && !isNaN(sunset)){ var posS=SunCalc.getPosition(sunset,dest.lat,dest.lng); if(posS && typeof posS.azimuth==='number') setAz=Math.round(bearingFromAzimuth(posS.azimuth)); }
    }
    lastSunData.rise = (sunrise instanceof Date && !isNaN(sunrise)) ? sunrise : null;
    lastSunData.set  = (sunset  instanceof Date && !isNaN(sunset )) ? sunset  : null;
    lastSunData.lat  = dest && typeof dest.lat==='number' ? dest.lat : null;
    lastSunData.lng  = dest && typeof dest.lng==='number' ? dest.lng : null;
    lastSunData.label = dest && dest.label ? dest.label : (dest && typeof dest.lat==='number' ? dest.lat.toFixed(4)+','+dest.lng.toFixed(4) : '');
    lastSunData.date = dEl.value || null;
    lastSunData.riseAz = riseAz;
    lastSunData.setAz = setAz;
  }
  function updateSunDirection(lat,lng,sunrise,sunset){
    sunDirectionLines.forEach(function(line){ if(line && line.setMap) line.setMap(null); });
    sunDirectionLines=[];
    if(!map || typeof lat!=='number' || typeof lng!=='number') return;
    function addLine(time,color){
      if(!(time instanceof Date) || isNaN(time)) return;
      var pos=SunCalc.getPosition(time, lat, lng); if(!pos || typeof pos.azimuth!=='number') return;
      var dest=projectPoint(lat,lng,4000,bearingFromAzimuth(pos.azimuth));
      var line=new google.maps.Polyline({ map:map, path:[{lat:lat,lng:lng},dest], strokeColor:color, strokeOpacity:0.85, strokeWeight:3 });
      sunDirectionLines.push(line);
    }
    addLine(sunrise,'#fbbf24');
    addLine(sunset,'#fb923c');
  }
  function forecastKey(lat,lng,dateStr){ return lat.toFixed(3)+','+lng.toFixed(3)+'|'+dateStr; }
  function getForecast(lat,lng,dateStr){
    var key=forecastKey(lat,lng,dateStr);
    var entry=forecastCache[key];
    var now=Date.now();
    if(entry && entry.data && now-entry.time<30*60*1000){ return Promise.resolve(entry.data); }
    if(entry && entry.promise){ return entry.promise; }
    entry = forecastCache[key] = entry || {};
    entry.promise=new Promise(function(resolve,reject){
      clearTimeout(entry.timer);
      entry.timer=setTimeout(function(){
        var endRange=dateStr;
        var baseDate=dateFromInput(dateStr);
        if(baseDate instanceof Date && !isNaN(baseDate)){
          var endDate=new Date(baseDate);
          endDate.setUTCDate(endDate.getUTCDate()+9);
          endRange=endDate.toISOString().slice(0,10);
        }
        var dailyFields='sunrise,sunset,precipitation_probability_max,precipitation_sum,cloudcover_mean,temperature_2m_max,temperature_2m_min';
        fetch('https://api.open-meteo.com/v1/forecast?latitude='+lat+'&longitude='+lng+'&daily='+dailyFields+'&hourly=temperature_2m,cloudcover,wind_speed_10m,relative_humidity_2m,visibility,precipitation,sunshine_duration&timezone='+encodeURIComponent(TZ)+'&start_date='+dateStr+'&end_date='+endRange)
          .then(function(r){ if(!r.ok) throw new Error('http'); return r.json(); })
          .then(function(data){ entry.data=data; entry.time=Date.now(); delete entry.promise; resolve(data); })
          .catch(function(err){ delete forecastCache[key]; reject(err); });
      },250);
    });
    return entry.promise;
  }

  function updateSunWeather(){
    var dest=points[points.length-1], dStr=dEl.value;
    setText('sp-rise-date', dStr||''); setText('sp-set-date', dStr||'');
    if(!dest || !dStr){
      setSunMeta(null,null,null);
      clearWeatherPanels();
      renderHourlyChart(null,null,false);
      renderSunshineChart(null,null,false);
      updateSunDirection(null,null);
      applyBands(null);

      sessionSummaryDefault();

      return;
    }

    var base=dateFromInput(dStr);
    applyBands(bands(dest.lat, dest.lng, base));

    var t=SunCalc.getTimes(base, dest.lat, dest.lng);
    var sunrise=t.sunrise, sunset=t.sunset;

    setSunMeta(dest, sunrise, sunset);
    updateSunDirection(dest.lat, dest.lng, sunrise, sunset);

    fillCardTimes('rise', sunrise, RISE_OFF, +$('#sp-slider-rise').value);
    fillCardTimes('set' , sunset , SET_OFF , +$('#sp-slider-set').value);

    clearWeatherPanels();
    renderHourlyChart(null,dStr,true);
    renderSunshineChart(null,dStr,true);
    sessionSummaryLoading();

    getForecast(dest.lat, dest.lng, dStr)
      .then(function(data){
        if(!data){ renderHourlyChart(null,dStr,false); renderSunshineChart(null,dStr,false); sessionSummaryNoData(); return; }
        var sr = (data.daily && data.daily.sunrise && data.daily.sunrise[0]) ? parseLocalISO(data.daily.sunrise[0]) : null;
        var ss = (data.daily && data.daily.sunset  && data.daily.sunset[0]) ? parseLocalISO(data.daily.sunset[0]) : null;
        if(sr instanceof Date && !isNaN(sr)) sunrise=sr;
        if(ss instanceof Date && !isNaN(ss)) sunset=ss;
        setSunMeta(dest, sunrise, sunset);
        updateSunDirection(dest.lat, dest.lng, sunrise, sunset);
        fillCardTimes('rise', sunrise, RISE_OFF, +$('#sp-slider-rise').value);
        fillCardTimes('set' , sunset , SET_OFF , +$('#sp-slider-set').value);
        var derivedBands = deriveBandsFromSun(sunrise, sunset);
        if(derivedBands) applyBands(derivedBands);
        if(data.hourly){
          setWeatherOnly('rise', data.hourly, sunrise);
          setWeatherOnly('set' , data.hourly, sunset);
        }
        renderHourlyChart(data.hourly, dStr, false);
        renderSunshineChart(data.hourly, dStr, false);
        renderSessionSummary(data, dStr);
      })
      .catch(function(){ renderHourlyChart(null,dStr,false); renderSunshineChart(null,dStr,false); sessionSummaryNoData(); });
  }

  function assignRadarTemplate(template){
    if(!template) return false;
    radarTemplate = template;
    radarFetchedAt = Date.now();
    return true;
  }
  function useRadarFallback(){
    for(var i=0;i<RADAR_FALLBACKS.length;i++){
      var tpl=RADAR_FALLBACKS[i];
      if(tpl){ assignRadarTemplate(tpl); return; }
    }
  }
  function fetchRadarDirect(){
    return fetch('https://api.rainviewer.com/public/weather-maps.json',{headers:{'Accept':'application/json'}})
      .then(function(r){ if(!r.ok) throw new Error('http'); return r.json(); })
      .then(function(data){
        var nowcast = (data && data.radar && Array.isArray(data.radar.nowcast)) ? data.radar.nowcast : [];
        var past = (data && data.radar && Array.isArray(data.radar.past)) ? data.radar.past : [];
        var frames = nowcast.concat(past);
        if(!frames.length) throw new Error('no-data');
        var template = null;
        function buildTemplate(base,path){
          if(!path) return null;

          var raw=String(path).trim();
          if(!raw) return null;
          var host='';
          var clean=raw;
          if(/^https?:\/\//i.test(clean)){
            host='';
          } else {
            host=(base||'').replace(/\/+$/,'/');
            clean=clean.replace(/^\/+/, '');
          }
          var candidate=(host||'')+clean;
          if(candidate.indexOf('https://tilecache.rainviewer.com/')!==0){
            if(/^https?:\/\//i.test(candidate)) return null;
            candidate='https://tilecache.rainviewer.com/'+candidate.replace(/^\/+/, '');
          }
          if(candidate.indexOf('{z}')!==-1 && candidate.indexOf('{x}')!==-1 && candidate.indexOf('{y}')!==-1){
            return candidate;
          }
          return candidate.replace(/\/+$/, '') + '/256/{z}/{x}/{y}/2/1_1.png';
        }
        for(var i=frames.length-1;i>=0;i--){
          var frame=frames[i];
          if(!frame) continue;
          if(!template && frame.host && frame.path){
            template = buildTemplate(frame.host, frame.path);

          }
          if(!template && frame.path){
            var pathStr=String(frame.path);
            var base = pathStr.indexOf('v3/') === 0 ? 'https://tilecache.rainviewer.com/' : 'https://tilecache.rainviewer.com/v2/radar/';
            template = buildTemplate(base, pathStr);
          }
          if(!template && frame.url){
            template = buildTemplate('', frame.url);
          }
          if(!template && typeof frame.time !== 'undefined'){
            template = buildTemplate('https://tilecache.rainviewer.com/v2/radar/', frame.time);
          }

          if(template) break;
        }
        if(!template) throw new Error('no-template');
        assignRadarTemplate(template);

      });
  }
  function fetchRadarViaProxy(){
    if(!RADAR_URL) return Promise.reject(new Error('no-proxy'));
    return fetch(RADAR_URL,{cache:'no-store'})
      .then(function(r){ if(!r.ok) throw new Error('http'); return r.json(); })
      .then(function(data){
        if(data && data.template){ assignRadarTemplate(data.template); return; }
        throw new Error('no-template');
      });
  }

  function fetchRadarTemplate(){
    var promise;
    if(RADAR_URL){
      promise = fetchRadarViaProxy().catch(function(err){ console.warn('SunPlanner radar proxy fallback', err); return fetchRadarDirect(); });
    } else {
      promise = fetchRadarDirect();
    }
    return promise.catch(function(err){ console.warn('SunPlanner radar template fallback', err); useRadarFallback(); });
  }
  function ensureRadarLayer(){
    var needsRefresh = !radarTemplate || (Date.now() - radarFetchedAt > 10*60*1000);
    var ready = needsRefresh ? fetchRadarTemplate() : Promise.resolve();
    return ready.then(function(){
      if(!radarTemplate) throw new Error('no-template');
      if(!radarLayer){
        radarLayer=new google.maps.ImageMapType({
          getTileUrl:function(coord,zoom){
            if(!radarTemplate) return null;
            var numTiles=1<<zoom;
            var y=coord.y;
            if(y<0 || y>=numTiles) return null;
            var x=((coord.x%numTiles)+numTiles)%numTiles;
            return radarTemplate.replace('{z}',zoom).replace('{x}',x).replace('{y}',y);
          },
          tileSize:new google.maps.Size(256,256),
          opacity:0.6,
          name:'Radar opadów'
        });
      }
      return radarLayer;
    });
  }
  function toggleRadar(enabled){
    if(!map) return;
    var overlays=map.overlayMapTypes;
    if(enabled){
      ensureRadarLayer().then(function(layer){
        var exists=false;
        for(var i=0;i<overlays.getLength();i++){ if(overlays.getAt(i)===layer){ exists=true; break; } }
        if(!exists) overlays.insertAt(0,layer);
      }).catch(function(){
        var radarEl=$('#sp-radar');
        if(radarEl) radarEl.checked=false;
        pendingRadar=false;
        toast('Radar chwilowo niedostępny');
        updateLink();
      });
    } else {
      for(var j=overlays.getLength()-1;j>=0;j--){ if(overlays.getAt(j)===radarLayer){ overlays.removeAt(j); } }
    }
  }
  function applyPendingRadar(){
    var radarEl=$('#sp-radar');
    if(!radarEl) return;
    radarEl.checked = !!pendingRadar;
    if(pendingRadar) toggleRadar(true);
  }
  function setShortLink(url){
    shortLinkValue=url;
    var box=$('#sp-short-status');
    if(box){
      box.innerHTML='';
      if(url){
        var span=document.createElement('strong'); span.textContent='Krótki link: ';
        var a=document.createElement('a'); a.href=url; a.target='_blank'; a.rel='noopener'; a.textContent=url;
        box.appendChild(span); box.appendChild(a);
      }
    }
    if(url){
      try{ navigator.clipboard.writeText(url); toast('Krótki link skopiowany','ok'); }
      catch(e){ toast('Krótki link gotowy','ok'); }
    }
  }
  function createShortLink(){
    if(!REST_URL){ toast('Funkcja skróconego linku niedostępna'); return; }
    var box=$('#sp-short-status'); if(box){ box.textContent='Generuję link...'; }
    fetch(REST_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sp:b64url.enc(packState())})})
      .then(function(r){ if(!r.ok) throw new Error('http'); return r.json(); })
      .then(function(data){ if(data && data.url){ setShortLink(data.url); } else { if(box) box.textContent='Nie udało się wygenerować linku.'; } })
      .catch(function(){ if(box) box.textContent='Nie udało się wygenerować linku.'; });
  }
  function formatICS(date){
    if(!(date instanceof Date) || isNaN(date)) return null;
    return date.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')+'Z';
  }
  function exportCalendar(){
    if(!lastSunData || !lastSunData.rise || !lastSunData.set || !lastSunData.date){ toast('Uzupełnij plan trasy.'); return; }
    var riseICS=formatICS(lastSunData.rise);
    var setICS=formatICS(lastSunData.set);
    if(!riseICS || !setICS){ toast('Brak danych do eksportu.'); return; }
    var destLabel=lastSunData.label || 'Cel';
    var uidBase=Date.now();
    var lines=[
      'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//SunPlanner//PL',
      'BEGIN:VEVENT',
      'UID:'+uidBase+'-rise@sunplanner',
      'DTSTAMP:'+formatICS(new Date()),
      'DTSTART:'+riseICS,
      'DTEND:'+formatICS(new Date(lastSunData.rise.getTime()+3600000)),
      'SUMMARY:Świt - '+destLabel,
      'LOCATION:'+(destLabel.replace(/\r?\n/g,' ')),
      'DESCRIPTION:Plan świtu dla '+destLabel,
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:'+uidBase+'-set@sunplanner',
      'DTSTAMP:'+formatICS(new Date()),
      'DTSTART:'+setICS,
      'DTEND:'+formatICS(new Date(lastSunData.set.getTime()+3600000)),
      'SUMMARY:Zachód - '+destLabel,
      'LOCATION:'+(destLabel.replace(/\r?\n/g,' ')),
      'DESCRIPTION:Plan zachodu dla '+destLabel,
      'END:VEVENT',
      'END:VCALENDAR'
    ];
    var blob=new Blob([lines.join('\r\n')],{type:'text/calendar'});
    var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='sunplanner-'+lastSunData.date+'.ics';
    document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); document.body.removeChild(a); },0);
  }
  function activeRouteMetrics(){ return currentRoutes[activeRouteIndex] ? routeMetrics(currentRoutes[activeRouteIndex]) : null; }
  function openClientCard(){
    var dest=points[points.length-1];
    if(!dest){ toast('Dodaj cel trasy.'); return; }
    var metrics=activeRouteMetrics();
    var w=window.open('', '_blank');
    if(!w){ toast('Odblokuj wyskakujące okna.'); return; }
    var esc=function(str){
      return String(str||'').replace(/[&<>"']/g,function(ch){
        switch(ch){
          case '&': return '&amp;';
          case '<': return '&lt;';
          case '>': return '&gt;';
          case '"': return '&quot;';
          case '\'': return '&#39;';
          default: return ch;
        }
      });
    };
    var pointsHtml=points.map(function(p,i){ return '<li>'+(i+1)+'. '+esc(p.label||('Punkt '+(i+1)))+'</li>'; }).join('');
    var riseText=fmt(lastSunData.rise);
    var setTextVal=fmt(lastSunData.set);
    var distTxt = metrics && metrics.distanceKm ? metrics.distanceKm.toFixed(1)+' km' : '—';
    var min=metrics ? Math.round(metrics.durationSec/60) : 0;
    var h=Math.floor(min/60), m=min%60;
    var timeTxt = metrics ? ((h? h+' h ':'')+m+' min') : '—';
    var hourlyCanvas=document.getElementById('sp-hourly');
    var sunshineCanvas=document.getElementById('sp-sunshine');
    var hourlyImage='';
    var sunshineImage='';
    try{ hourlyImage=hourlyCanvas && hourlyCanvas.toDataURL ? hourlyCanvas.toDataURL('image/png') : ''; }catch(err2){ hourlyImage=''; }
    try{ sunshineImage=sunshineCanvas && sunshineCanvas.toDataURL ? sunshineCanvas.toDataURL('image/png') : ''; }catch(err3){ sunshineImage=''; }
    function chartBlock(title,src,alt,empty){
      if(src){ return '<div class="chart-card"><h3>'+title+'</h3><img src="'+esc(src)+'" alt="'+esc(alt)+'"></div>'; }
      return '<div class="chart-card"><h3>'+title+'</h3><p class="muted">'+esc(empty)+'</p></div>';
    }
    var chartsHtml = chartBlock('Mini-wykres godzinowy – prognoza pogody', hourlyImage, 'Mini-wykres godzinowy – prognoza pogody', 'Brak danych wykresu.');
    chartsHtml += chartBlock('Godziny ze słońcem', sunshineImage, 'Godziny ze słońcem', 'Brak danych wykresu o słońcu.');
    var html='<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8"><title>Karta klienta</title><style>body{font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;color:#111;padding:24px;}h1{margin:0 0 12px;font-size:24px;}section{margin-bottom:20px;}table{width:100%;border-collapse:collapse;margin-top:12px;}td,th{border:1px solid #e5e7eb;padding:8px;text-align:left;}ul{padding-left:18px;}small{color:#6b7280;}.muted{color:#6b7280;}.chart-grid{display:flex;gap:20px;flex-wrap:wrap;margin-top:12px;}.chart-card{flex:1 1 280px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:16px;padding:16px;box-shadow:0 8px 18px rgba(15,23,42,0.08);} .chart-card h3{margin:0 0 12px;font-size:18px;} .chart-card img{width:100%;display:block;border-radius:12px;border:1px solid #d1d5db;background:#fff;} .chart-card p{margin:8px 0 0;color:#6b7280;}</style></head><body>'+
      '<h1>Karta klienta – '+esc(dest.label||'Plan pleneru')+'</h1>'+
      '<section><strong>Data:</strong> '+esc(dEl.value||'—')+'<br><strong>Cel:</strong> '+esc(dest.label||'—')+'<br><strong>Dystans:</strong> '+esc(distTxt)+'<br><strong>Czas przejazdu:</strong> '+esc(timeTxt)+'</section>'+
      '<section><table><tr><th>Moment</th><th>Godzina</th><th>Azymut</th></tr><tr><td>Świt</td><td>'+esc(riseText)+'</td><td>'+(lastSunData.riseAz!=null?esc(lastSunData.riseAz+'°'):'—')+'</td></tr><tr><td>Zachód</td><td>'+esc(setTextVal)+'</td><td>'+(lastSunData.setAz!=null?esc(lastSunData.setAz+'°'):'—')+'</td></tr></table></section>'+
      '<section><h2>Wizualizacje</h2><div class="chart-grid">'+chartsHtml+'</div></section>'+
      '<section><h2>Punkty trasy</h2><ul>'+pointsHtml+'</ul></section>'+
      '<section><h2>Uwagi</h2><p>Notatki klienta:</p><div style="min-height:80px;border:1px solid #e5e7eb;border-radius:8px;"></div></section>'+
      '<small>Wygenerowano przez SunPlanner.</small>'+
      '</body></html>';
    w.document.write(html);
    w.document.close();
    setTimeout(function(){ try{w.focus(); w.print();}catch(e){} }, 400);
  }
  function locateStart(){
    if(!navigator.geolocation){ toast('Brak wsparcia geolokalizacji w przeglądarce'); return; }
    navigator.geolocation.getCurrentPosition(function(pos){
      var lat=pos.coords.latitude, lng=pos.coords.longitude;
      function apply(label){
        var point={lat:lat,lng:lng,label:label||'Moja lokalizacja'};
        if(points.length){ points[0]=point; }
        else points.push(point);
        if(map && typeof map.panTo==='function'){ map.panTo({lat:lat,lng:lng}); if(typeof map.getZoom==='function' && map.getZoom()<12){ map.setZoom(12); } }
        if(dragMarker){ dragMarker.setPosition({lat:lat,lng:lng}); dragMarker.setVisible(true); }
        renderList(); recalcRoute(false); updateDerived(); loadGallery();
        toast('Zaktualizowano punkt startowy','ok');
      }
      if(geocoder){
        geocoder.geocode({location:{lat:lat,lng:lng}},function(res,st){
          if(st==='OK' && res && res[0]) apply(res[0].formatted_address); else apply('Moja lokalizacja');
        });
      } else apply('Moja lokalizacja');
    }, function(){ toast('Nie udało się pobrać lokalizacji'); }, {enableHighAccuracy:true,timeout:8000});
  }

  // galeria (tylko cel, 6 zdjęć, link w nowym oknie)
  function loadGallery(){
    var dest=points[points.length-1]; var label=dest? (dest.label||'') : ''; var gal=$('#sp-gallery');
    if(!label){ gal.innerHTML=''; return; }
    gal.innerHTML='<div class="muted">Ładuję zdjęcia...</div>';

    function renderItems(items, makeUrl, makeThumb){
      gal.innerHTML='';
      items.forEach(function(it){
        var a=document.createElement('a'); a.href=makeUrl(it); a.target='_blank'; a.rel='noopener';
        var img=new Image(); img.src=makeThumb(it); img.loading='lazy'; img.alt=label+' - inspiracja';
        a.appendChild(img); gal.appendChild(a);
      });
      if(!gal.children.length) gal.innerHTML='<div class="muted">Brak zdjęć.</div>';
    }

    if(CSE_ID){
      fetch('https://www.googleapis.com/customsearch/v1?key='+GMAPS_KEY+'&cx='+CSE_ID+'&searchType=image&num=6&q='+encodeURIComponent(label+' sesja ślubna'))
        .then(function(r){ return r.json(); })
        .then(function(data){
          if(data && data.items && data.items.length){
            renderItems(data.items.slice(0,6), function(it){ return it.link; }, function(it){ return (it.image && it.image.thumbnailLink)? it.image.thumbnailLink : it.link; });
          } else {
            // fallback Unsplash
            fetch('https://api.unsplash.com/search/photos?per_page=6&query='+encodeURIComponent(label+' wedding shoot')+'&client_id='+UNSPLASH_KEY)
              .then(function(r){ return r.json(); })
              .then(function(d){
                var arr=(d && d.results)? d.results : [];
                renderItems(arr, function(p){ return (p.links && p.links.html) ? p.links.html : (p.urls && p.urls.regular ? p.urls.regular : '#'); }, function(p){ return p.urls.small; });
              })
              .catch(function(){ gal.innerHTML='<div class="muted">Błąd galerii.</div>'; });
          }
        })
        .catch(function(){ gal.innerHTML='<div class="muted">Błąd galerii.</div>'; });
    } else {
      fetch('https://api.unsplash.com/search/photos?per_page=6&query='+encodeURIComponent(label+' wedding shoot')+'&client_id='+UNSPLASH_KEY)
        .then(function(r){ return r.json(); })
        .then(function(d){
          var arr=(d && d.results)? d.results : [];
          renderItems(arr, function(p){ return (p.links && p.links.html) ? p.links.html : (p.urls && p.urls.regular ? p.urls.regular : '#'); }, function(p){ return p.urls.small; });
        })
        .catch(function(){ gal.innerHTML='<div class="muted">Błąd galerii.</div>'; });
    }
  }

  // mapa
  function initMap(){
    var mapEl=document.getElementById('planner-map');
    if(mapEl.offsetHeight<50) mapEl.style.minHeight='420px';

    var DEF={lat:49.2992,lng:19.9496};
    map=new google.maps.Map(mapEl,{
      center:DEF, zoom:11, disableDefaultUI:false,
      gestureHandling:'greedy', zoomControl:true, mapTypeControl:false, streetViewControl:false
    });

    // blokada scrolla strony nad mapa (zoom zostaje)
    mapEl.addEventListener('wheel', function(e){ e.preventDefault(); }, {passive:false});

    geocoder=new google.maps.Geocoder();
    dirService=new google.maps.DirectionsService();

    dragMarker=new google.maps.Marker({position:DEF,map:map,draggable:true,visible:false});
    google.maps.event.addListener(map,'click',function(e){ dragMarker.setPosition(e.latLng); dragMarker.setVisible(true); });

    placesAutocomplete=new google.maps.places.Autocomplete($('#sp-place'),{fields:['geometry','name']});
    placesAutocomplete.addListener('place_changed',function(){
      var pl=placesAutocomplete.getPlace(); if(!pl || !pl.geometry) return;
      var pos=pl.geometry.location;
      points.push({lat:pos.lat(),lng:pos.lng(),label:pl.name||$('#sp-place').value||'Punkt'});
      $('#sp-place').value='';
      renderList(); recalcRoute(false); updateDerived(); loadGallery();
    });

    renderList(); updateDerived(); renderRouteOptions();
    if(points.length>=2) recalcRoute(false); else updateSunWeather();
    loadGallery(); updateLink();

    applyPendingRadar();

    google.maps.event.addListenerOnce(map,'idle',function(){ google.maps.event.trigger(map,'resize'); });
  }

  // UI
  $('#sp-add').addEventListener('click', function(){
    var val=$('#sp-place').value.trim();
    if(val){
      geocode(val).then(function(p){
        points.push({lat:p.lat,lng:p.lng,label:p.label||val}); $('#sp-place').value='';
        renderList(); recalcRoute(false); updateDerived(); loadGallery();
      }).catch(function(){ toast('Nie znaleziono'); });
    } else if(dragMarker && dragMarker.getVisible && dragMarker.getVisible()){
      var pos=dragMarker.getPosition(); points.push({lat:pos.lat(),lng:pos.lng(),label:'Punkt z mapy'});
      renderList(); recalcRoute(false); updateDerived(); loadGallery();
    } else {
      toast('Wpisz nazwę miejsca lub kliknij na mapie, aby dodać punkt.');
    }
  });
  $('#sp-clear').addEventListener('click', function(){
    points=[]; renderList(); clearRenderers(); currentRoutes=[]; activeRouteIndex=0; renderRouteOptions();
    setText('sp-t-time','—'); setText('sp-t-dist','—'); setText('sp-loc','—');
    loadGallery(); updateSunWeather(); updateLink();
  });
  $('#sp-copy').addEventListener('click', function(){
    updateLink();
    var linkEl=$('#sp-link');
    var txt=linkEl?linkEl.textContent:location.href;
    try{ navigator.clipboard.writeText(txt); toast('Skopiowano link','ok'); }
    catch(e){ toast('Link gotowy'); }
  });
  $('#sp-short').addEventListener('click', createShortLink);
  $('#sp-ics').addEventListener('click', exportCalendar);
  $('#sp-client-card').addEventListener('click', openClientCard);
  $('#sp-print').addEventListener('click', function(){ window.print(); });
  $('#sp-geo').addEventListener('click', locateStart);
  var coupleEmailInput=$('#sp-couple-email');
  if(coupleEmailInput){ coupleEmailInput.addEventListener('input', function(e){ plannerState.couple.email=e.target.value; updateLink(); }); }
  var coupleNotesInput=$('#sp-couple-notes');
  if(coupleNotesInput){ coupleNotesInput.addEventListener('input', function(e){ plannerState.couple.notes=e.target.value; updateLink(); }); }
  var photographerEmailInput=$('#sp-photographer-email');
  if(photographerEmailInput){ photographerEmailInput.addEventListener('input', function(e){ plannerState.photographer.email=e.target.value; updateLink(); }); }
  var photographerNotesInput=$('#sp-photographer-notes');
  if(photographerNotesInput){ photographerNotesInput.addEventListener('input', function(e){ plannerState.photographer.notes=e.target.value; updateLink(); }); }
  var coupleDateInput=$('#sp-couple-date');
  var coupleTimeInput=$('#sp-couple-time');
  var photographerDateInput=$('#sp-photographer-date');
  var photographerTimeInput=$('#sp-photographer-time');
  if(coupleDateInput && dEl.value){ coupleDateInput.value = dEl.value; }
  if(photographerDateInput && dEl.value){ photographerDateInput.value = dEl.value; }
  if(coupleDateInput){ coupleDateInput.min = dEl.min; coupleDateInput.max = dEl.max; }
  if(photographerDateInput){ photographerDateInput.min = dEl.min; photographerDateInput.max = dEl.max; }
  var coupleAddBtn=$('#sp-couple-add');
  if(coupleAddBtn){
    coupleAddBtn.addEventListener('click', function(){
      if(!coupleDateInput || !coupleDateInput.value){ toast('Podaj datę proponowanego terminu.'); return; }
      addPlannerSlot('couple', coupleDateInput.value, coupleTimeInput?coupleTimeInput.value:'');
      if(coupleTimeInput) coupleTimeInput.value='';
    });
  }
  var photographerAddBtn=$('#sp-photographer-add');
  if(photographerAddBtn){
    photographerAddBtn.addEventListener('click', function(){
      if(!photographerDateInput || !photographerDateInput.value){ toast('Podaj datę wolnego terminu fotografa.'); return; }
      addPlannerSlot('photographer', photographerDateInput.value, photographerTimeInput?photographerTimeInput.value:'');
      if(photographerTimeInput) photographerTimeInput.value='';
    });
  }
  var notifyPhotographerBtn=$('#sp-notify-photographer');
  if(notifyPhotographerBtn){ notifyPhotographerBtn.addEventListener('click', function(){ sendPlannerNotification('photographer'); }); }
  var notifyCoupleBtn=$('#sp-notify-couple');
  if(notifyCoupleBtn){ notifyCoupleBtn.addEventListener('click', function(){ sendPlannerNotification('couple'); }); }
  var radarToggle=$('#sp-radar');
  if(radarToggle){ radarToggle.addEventListener('change', function(e){ pendingRadar=!!e.target.checked; toggleRadar(pendingRadar); updateLink(); }); }
  dEl.addEventListener('change', function(){ updateDerived(); updateSunWeather(); });

  // suwaki
  function hookSlider(ringId,txtId,sliderId,cb){
    var r=document.getElementById(ringId), t=document.getElementById(txtId), s=document.getElementById(sliderId);
    function apply(v){ var rr=+r.getAttribute('r'), per=2*Math.PI*rr, pct=(v-1)/7; r.style.strokeDasharray=per; r.style.strokeDashoffset=per*(1-pct); t.textContent=v+' h'; if(cb) cb(); updateLink(); }
    s.addEventListener('input', function(e){ apply(+e.target.value); }); apply(+s.value);
  }
  hookSlider('sp-ring-rise','sp-txt-rise','sp-slider-rise', updateSunWeather);
  hookSlider('sp-ring-set','sp-txt-set','sp-slider-set', updateSunWeather);

  // link
  function updateLink(){
    var base = BASE_URL;
    var joiner = base.indexOf('?') === -1 ? '?' : '&';
    var url = base + joiner + 'sp=' + b64url.enc(packState());
    history.replaceState(null,'',url);
    var linkEl=$('#sp-link'); if(linkEl) linkEl.textContent = url;
    if(shortLinkValue){
      shortLinkValue=null;
      var box=$('#sp-short-status'); if(box) box.textContent='Plan zmieniony. Wygeneruj nowy krótki link.';
    }
    persistState();
  }

  // start
  function startApp(){ try{ updateSunWeather(); }catch(e){} if(window.google && window.google.maps){ initMap(); } }
  if(window.google && window.google.maps) startApp();
  window.addEventListener('sunplanner:gmaps-ready', startApp, { once:true });
})();
