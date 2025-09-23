/* SunPlanner v1.7.0 - rozbudowany planner z wykresem slonca, radarowa warstwa mapy, autosave i eksportami */
(function(){
  var CFG = window.SUNPLANNER_CFG || {};
  var GMAPS_KEY    = CFG.GMAPS_KEY || '';
  var CSE_ID       = CFG.CSE_ID || '';
  var UNSPLASH_KEY = CFG.UNSPLASH_KEY || '';
  var TZ           = CFG.TZ || (Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Warsaw');
  var REST_URL     = CFG.REST_URL || '';
  var SITE_ORIGIN  = CFG.SITE_ORIGIN || '';
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
      '<input id="sp-place" class="input" placeholder="Dodaj punkt: Start / Przystanek / Cel">'+
      '<button id="sp-add" class="btn" type="button">Dodaj</button>'+
      '<button id="sp-geo" class="btn secondary" type="button">Skad jade?</button>'+
      '<input id="sp-date" class="input" type="date" style="max-width:170px">'+
      '<button id="sp-clear" class="btn secondary" type="button">Wyczysc</button>'+
    '</div>'+
    '<div class="toolbar">'+
      '<label class="switch"><input id="sp-radar" type="checkbox">Radar opadow</label>'+
      '<div class="legend">'+
        '<span class="c1"><i></i>Najlepsza</span>'+
        '<span class="c2"><i></i>Alternatywa</span>'+
        '<span class="c3"><i></i>Opcja</span>'+
      '</div>'+
    '</div>'+
    '<div id="planner-map" aria-label="Mapa"></div>'+
    '<div class="cards">'+
      '<div class="card">'+
        '<h3>Plan dnia</h3>'+
        '<div class="rowd"><span class="muted">Cel (ostatni punkt)</span><strong id="sp-loc">—</strong></div>'+
        '<div class="rowd"><span class="muted">Data</span><strong id="sp-date-label">—</strong></div>'+
        '<div class="rowd"><span>Czas jazdy</span><strong id="sp-t-time">—</strong></div>'+
        '<div class="rowd"><span>Dystans</span><strong id="sp-t-dist">—</strong></div>'+

        '<div class="grid2" style="margin-top:.75rem">'+
          '<div class="card" style="padding:.75rem">'+
            '<h3 style="margin-bottom:.25rem">Swit <small id="sp-rise-date" class="muted"></small></h3>'+
            '<div class="rowd"><span>Swit</span><strong id="sp-rise-sun">—</strong></div>'+
            '<div class="rowd"><span>Start</span><strong id="sp-rise-start">—</strong></div>'+
            '<div class="rowd"><span>Wyjazd</span><strong id="sp-rise-wake">—</strong></div>'+
            '<div class="rowd"><span>Sen od</span><strong id="sp-rise-bed">—</strong></div>'+
            '<p class="muted" style="margin:.25rem 0 .4rem">Ile snu chcesz miec?</p>'+
            '<div style="display:flex;align-items:center;gap:.7rem">'+
              '<div class="ring">'+
                '<svg width="56" height="56"><circle cx="28" cy="28" r="24" stroke="#e5e7eb" stroke-width="4" fill="none"></circle><circle id="sp-ring-rise" cx="28" cy="28" r="24" stroke="#e94244" stroke-width="4" fill="none" stroke-linecap="round"></circle></svg>'+
                '<div class="text" id="sp-txt-rise">6 h</div>'+
              '</div>'+
              '<input id="sp-slider-rise" class="slider" type="range" min="1" max="8" step="1" value="6" style="flex:1">'+
            '</div>'+
            '<div class="badge" id="sp-gold-am">Zlota — —</div>'+
            '<div class="badge" id="sp-blue-am">Niebieska — —</div>'+
            '<div class="kpi">'+
              '<div class="rowd"><span>Temp.</span><strong id="sp-rise-t">—</strong></div>'+
              '<div class="rowd"><span>Wiatr</span><strong id="sp-rise-w">—</strong></div>'+
              '<div class="rowd"><span>Chmury</span><strong id="sp-rise-c">—</strong></div>'+
              '<div class="rowd"><span>Wilg.</span><strong id="sp-rise-h">—</strong></div>'+
              '<div class="rowd"><span>Widzoc.</span><strong id="sp-rise-v">—</strong></div>'+
              '<div class="rowd"><span>Opady</span><strong id="sp-rise-p">—</strong></div>'+
            '</div>'+
          '</div>'+
          '<div class="card" style="padding:.75rem">'+
            '<h3 style="margin-bottom:.25rem">Zachod <small id="sp-set-date" class="muted"></small></h3>'+
            '<div class="rowd"><span>Zachod</span><strong id="sp-set-sun">—</strong></div>'+
            '<div class="rowd"><span>Start</span><strong id="sp-set-start">—</strong></div>'+
            '<div class="rowd"><span>Wyjazd</span><strong id="sp-set-wake">—</strong></div>'+
            '<div class="rowd"><span>Przygot. do</span><strong id="sp-set-bed">—</strong></div>'+
            '<p class="muted" style="margin:.25rem 0 .4rem">Ile potrzebujesz przygotowan?</p>'+
            '<div style="display:flex;align-items:center;gap:.7rem">'+
              '<div class="ring">'+
                '<svg width="56" height="56"><circle cx="28" cy="28" r="24" stroke="#e5e7eb" stroke-width="4" fill="none"></circle><circle id="sp-ring-set" cx="28" cy="28" r="24" stroke="#e94244" stroke-width="4" fill="none" stroke-linecap="round"></circle></svg>'+
                '<div class="text" id="sp-txt-set">6 h</div>'+
              '</div>'+
              '<input id="sp-slider-set" class="slider" type="range" min="1" max="8" step="1" value="6" style="flex:1">'+
            '</div>'+
            '<div class="badge" id="sp-gold-pm">Zlota — —</div>'+
            '<div class="badge" id="sp-blue-pm">Niebieska — —</div>'+
            '<div class="kpi">'+
              '<div class="rowd"><span>Temp.</span><strong id="sp-set-t">—</strong></div>'+
              '<div class="rowd"><span>Wiatr</span><strong id="sp-set-w">—</strong></div>'+
              '<div class="rowd"><span>Chmury</span><strong id="sp-set-c">—</strong></div>'+
              '<div class="rowd"><span>Wilg.</span><strong id="sp-set-h">—</strong></div>'+
              '<div class="rowd"><span>Widzoc.</span><strong id="sp-set-v">—</strong></div>'+
              '<div class="rowd"><span>Opady</span><strong id="sp-set-p">—</strong></div>'+
            '</div>'+
          '</div>'+
        '</div>'+

        '<h3 style="margin-top:1rem">Punkty trasy (start, przystanki, cel)</h3>'+
        '<div id="sp-list"></div>'+
        '<div class="row" style="margin-top:.4rem"><button id="sp-opt" class="btn secondary" type="button">Optymalizuj</button></div>'+

        '<h3 style="margin-top:1rem">Alternatywne trasy</h3>'+
        '<div id="sp-route-choices" class="route-options"></div>'+

        '<h3 style="margin-top:1rem">Udostepnij / Eksport</h3>'+
        '<div class="row share-row" style="align-items:flex-start">'+
          '<div class="col" style="flex:1">'+
            '<div class="row" style="gap:.35rem;flex-wrap:wrap">'+
              '<button id="sp-copy" class="btn secondary" type="button">Kopiuj link</button>'+
              '<button id="sp-short" class="btn secondary" type="button">Krotki link</button>'+
              '<button id="sp-ics" class="btn secondary" type="button">Eksport do kalendarza</button>'+
              '<button id="sp-client-card" class="btn secondary" type="button">Karta klienta</button>'+
              '<button id="sp-print" class="btn secondary" type="button">Drukuj / PDF</button>'+
            '</div>'+
            '<div class="muted" id="sp-link" style="margin-top:.25rem;word-break:break-all"></div>'+
            '<div class="muted" id="sp-short-status"></div>'+
          '</div>'+
        '</div>'+

        '<div class="card" style="margin-top:1rem;padding:.75rem">'+
          '<h3>Galeria inspiracji</h3>'+
          '<div id="sp-gallery"></div>'+
        '</div>'+
      '</div>'+
      '<div class="card">'+
        '<h3>Wykres sciezki slonca</h3>'+
        '<div class="sun-meta">'+
          '<div><span class="muted">Swit</span><strong id="sp-sunrise-time">—</strong><small id="sp-sunrise-az">—</small></div>'+
          '<div><span class="muted">Zachod</span><strong id="sp-sunset-time">—</strong><small id="sp-sunset-az">—</small></div>'+
        '</div>'+
        '<canvas id="sp-sun-canvas" class="smallcanvas" aria-label="Wykres slonca"></canvas>'+
      '</div>'+
      '<div class="card">'+
        '<h3>Mini-wykres godzinowy</h3>'+
        '<canvas id="sp-hourly" class="smallcanvas" aria-label="Prognoza godzinowa"></canvas>'+
      '</div>'+
    '</div>'+
  '</div>';

  // helpers (bez unicode w komunikatach)
  function $(s){ return document.querySelector(s); }
  function toast(m,type){ var t=$("#sp-toast"); t.textContent=m; t.style.display='block'; t.style.background=(type==='ok'?'#dcfce7':'#fee2e2'); t.style.color=(type==='ok'?'#14532d':'#991b1b'); clearTimeout(toast._t); toast._t=setTimeout(function(){t.style.display='none';}, 4200); }
  function fmt(d){ return d instanceof Date && !isNaN(d) ? d.toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'}) : '—'; }
  function setText(id,v){ var el=(id.charAt(0)==='#'?$(id):$('#'+id)); if(el) el.textContent=v; }
  function deg(rad){ return rad*180/Math.PI; }
  function bearingFromAzimuth(az){ return (deg(az)+180+360)%360; }

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
  var radarLayer = null;
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
      pts:points.map(function(p){return {lat:+p.lat,lng:+p.lng,label:p.label||'Punkt'};})
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
  }
  function persistState(){ if(!storageAvailable) return; try{ window.localStorage.setItem(STORAGE_KEY, b64url.enc(packState())); }catch(e){} }
  (function(){
    var params=new URLSearchParams(location.search);
    var sp=params.get('sp');
    if(sp){
      try{ unpackState(b64url.dec(sp)); restoredFromShare=true; }
      catch(e){ console.warn('SP decode',e); }
    } else if(storageAvailable){
      try{
        var saved=window.localStorage.getItem(STORAGE_KEY);
        if(saved){ unpackState(b64url.dec(saved)); }
      }catch(e){ }
    }
  })();

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
      msg.textContent='Dodaj co najmniej dwa punkty, aby zobaczyc trasy.';
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
      if(!valid.length){ toast('Trasa niedostepna'); driveMin=0; currentRoutes=[]; renderRouteOptions(); updateSunWeather(); return; }
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

      if(!currentRoutes.length){ toast('Trasa niedostepna'); driveMin=0; renderRouteOptions(); updateSunWeather(); return; }
      activeRouteIndex=0;
      setActiveRoute(0,true);
      refreshRendererStyles();
      updateSunWeather();
    }).catch(function(){ toast('Trasa niedostepna'); driveMin=0; currentRoutes=[]; renderRouteOptions(); updateSunWeather(); });
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
  function renderSunChart(lat,lng,date,sunrise,sunset){
    var canvas=document.getElementById('sp-sun-canvas');
    if(!canvas) return;
    var prep=prepareCanvas(canvas); if(!prep) return;
    var ctx=prep.ctx, width=prep.width, height=prep.height;
    ctx.fillStyle='#f9fafb';
    ctx.fillRect(0,0,width,height);
    if(typeof lat!=='number' || typeof lng!=='number' || !(date instanceof Date)){
      ctx.fillStyle='#9ca3af';
      ctx.font='12px system-ui, sans-serif';
      ctx.fillText('Dodaj cel, aby zobaczyc wykres.',12,height/2);
      return;
    }
    var start=new Date(date); start.setHours(0,0,0,0);
    var steps=48;
    var pts=[], altMin=90, altMax=-90;
    for(var i=0;i<=steps;i++){
      var dt=new Date(start.getTime()+i*30*60000);
      var pos=SunCalc.getPosition(dt, lat, lng) || {};
      var alt=pos.altitude!=null ? deg(pos.altitude) : -10;
      pts.push({time:dt,alt:alt});
      if(alt<altMin) altMin=alt;
      if(alt>altMax) altMax=alt;
    }
    altMin=Math.min(altMin,-10);
    altMax=Math.max(altMax,75);
    var range=altMax-altMin || 1;
    ctx.fillStyle='rgba(30,64,175,0.1)';
    ctx.beginPath();
    pts.forEach(function(pt,idx){
      var x=(idx/(pts.length-1||1))*width;
      var y=height-((pt.alt-altMin)/range)*height;
      if(idx===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.lineTo(width,height); ctx.lineTo(0,height); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#1e3a8a';
    ctx.lineWidth=2;
    ctx.beginPath();
    pts.forEach(function(pt,idx){
      var x=(idx/(pts.length-1||1))*width;
      var y=height-((pt.alt-altMin)/range)*height;
      if(idx===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();

    var zeroY=height-((0-altMin)/range)*height;
    ctx.strokeStyle='rgba(107,114,128,0.4)';
    ctx.setLineDash([4,4]);
    ctx.beginPath();
    ctx.moveTo(0,zeroY); ctx.lineTo(width,zeroY); ctx.stroke();
    ctx.setLineDash([]);

    ctx.font='11px system-ui, sans-serif';
    ctx.fillStyle='#374151';
    function mark(time,label,color){
      if(!(time instanceof Date) || isNaN(time)) return;
      var x=((time - start)/86400000)*width;
      if(x<0 || x>width) return;
      var pos=SunCalc.getPosition(time, lat, lng) || {};
      var alt=pos.altitude!=null ? deg(pos.altitude) : 0;
      var y=height-((alt-altMin)/range)*height;
      ctx.fillStyle=color;
      ctx.beginPath(); ctx.arc(x,y,4,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#1f2937';
      var txt=label+' '+fmt(time);
      var tx=x+8; if(tx>width-70) tx=x-70; if(tx<0) tx=2;
      ctx.fillText(txt, tx, y-6);
    }
    mark(sunrise,'Swit','#f59e0b');
    mark(sunset,'Zachod','#f97316');

    ctx.fillStyle='#6b7280';
    for(var h=0;h<=24;h+=3){
      var x=(h/24)*width;
      ctx.fillRect(x,height-4,1,4);
      var lbl=('0'+h).slice(-2)+':00';
      var tx=x-12; if(tx<0) tx=0; if(tx>width-24) tx=width-24;
      ctx.fillText(lbl, tx, height-6);
    }
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
    if(loading){ ctx.fillText('Ladowanie prognozy...',12,height/2); return; }
    if(!hourly || !hourly.time || !hourly.time.length){ ctx.fillText('Brak danych pogodowych.',12,height/2); return; }
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
    if(!points.length){ ctx.fillText('Brak danych dla wybranego dnia.',12,height/2); return; }
    var minTemp=Infinity,maxTemp=-Infinity,maxPrec=0;
    points.forEach(function(p){
      if(p.temp!=null){ if(p.temp<minTemp) minTemp=p.temp; if(p.temp>maxTemp) maxTemp=p.temp; }
      if(p.prec>maxPrec) maxPrec=p.prec;
    });
    if(minTemp===Infinity){ minTemp=0; maxTemp=0; }
    if(maxTemp-minTemp<4){ var adj=(4-(maxTemp-minTemp))/2; minTemp-=adj; maxTemp+=adj; }
    var chartHeight=height*0.6;
    var bottom=height-24;
    var range=(maxTemp-minTemp)||1;
    ctx.strokeStyle='#ef4444';
    ctx.lineWidth=2;
    ctx.beginPath();
    points.forEach(function(p,idx){
      var x=(idx/(points.length-1||1))*width;
      var temp=p.temp!=null?p.temp:minTemp;
      var y=bottom-((temp-minTemp)/range)*chartHeight;
      if(idx===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();
    ctx.lineTo(width,bottom);
    ctx.lineTo(0,bottom);
    ctx.closePath();
    ctx.fillStyle='rgba(239,68,68,0.12)';
    ctx.fill();

    if(maxPrec>0){
      ctx.fillStyle='rgba(37,99,235,0.35)';
      points.forEach(function(p,idx){
        if(!p.prec) return;
        var x=(idx/(points.length-1||1))*width;
        var barHeight=(p.prec/maxPrec)*(height*0.25);
        ctx.fillRect(x-3,bottom-barHeight,6,barHeight);
      });
    }

    ctx.fillStyle='#374151';
    ctx.font='11px system-ui, sans-serif';
    points.forEach(function(p,idx){
      if(idx%3!==0 && idx!==points.length-1) return;
      var x=(idx/(points.length-1||1))*width;
      var lbl=p.time.toLocaleTimeString('pl-PL',{hour:'2-digit'});
      ctx.fillText(lbl,x-10,height-6);
    });
    ctx.fillText(Math.round(maxTemp)+'°C',8,bottom-chartHeight-6);
    ctx.fillText(Math.round(minTemp)+'°C',8,bottom-6);
  }
  function setSunMeta(dest,sunrise,sunset){
    setText('sp-sunrise-time', fmt(sunrise));
    setText('sp-sunset-time', fmt(sunset));
    var riseAz=null, setAz=null;
    if(dest && typeof dest.lat==='number' && typeof dest.lng==='number'){
      if(sunrise instanceof Date && !isNaN(sunrise)){ var posR=SunCalc.getPosition(sunrise,dest.lat,dest.lng); if(posR && typeof posR.azimuth==='number') riseAz=Math.round(bearingFromAzimuth(posR.azimuth)); }
      if(sunset instanceof Date && !isNaN(sunset)){ var posS=SunCalc.getPosition(sunset,dest.lat,dest.lng); if(posS && typeof posS.azimuth==='number') setAz=Math.round(bearingFromAzimuth(posS.azimuth)); }
    }
    setText('sp-sunrise-az', riseAz!=null ? ('Azymut '+riseAz+'°') : '—');
    setText('sp-sunset-az', setAz!=null ? ('Azymut '+setAz+'°') : '—');
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
        fetch('https://api.open-meteo.com/v1/forecast?latitude='+lat+'&longitude='+lng+'&daily=sunrise,sunset&hourly=temperature_2m,cloudcover,wind_speed_10m,relative_humidity_2m,visibility,precipitation&timezone='+encodeURIComponent(TZ)+'&start_date='+dateStr+'&end_date='+dateStr)
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
      renderSunChart(null,null,null);
      renderHourlyChart(null,null,false);
      updateSunDirection(null,null);
      return;
    }

    var base=dateFromInput(dStr);
    var b=bands(dest.lat, dest.lng, base);
    function rng(a,b){ return fmt(a)+'–'+fmt(b); }
    setText('sp-gold-am','Zlota '+rng(b.bluePM[0],b.bluePM[1]));
    setText('sp-blue-am','Niebieska '+rng(b.goldPM[0],b.goldPM[1]));
    setText('sp-gold-pm','Zlota '+rng(b.blueAM[0],b.blueAM[1]));
    setText('sp-blue-pm','Niebieska '+rng(b.goldAM[0],b.goldAM[1]));

    var t=SunCalc.getTimes(base, dest.lat, dest.lng);
    var sunrise=t.sunrise, sunset=t.sunset;

    setSunMeta(dest, sunrise, sunset);
    renderSunChart(dest.lat, dest.lng, base, sunrise, sunset);
    updateSunDirection(dest.lat, dest.lng, sunrise, sunset);

    fillCardTimes('rise', sunrise, RISE_OFF, +$('#sp-slider-rise').value);
    fillCardTimes('set' , sunset , SET_OFF , +$('#sp-slider-set').value);

    clearWeatherPanels();
    renderHourlyChart(null,dStr,true);

    getForecast(dest.lat, dest.lng, dStr)
      .then(function(data){
        if(!data) return;
        var sr = (data.daily && data.daily.sunrise && data.daily.sunrise[0]) ? parseLocalISO(data.daily.sunrise[0]) : null;
        var ss = (data.daily && data.daily.sunset  && data.daily.sunset[0]) ? parseLocalISO(data.daily.sunset[0]) : null;
        if(sr instanceof Date && !isNaN(sr)) sunrise=sr;
        if(ss instanceof Date && !isNaN(ss)) sunset=ss;
        setSunMeta(dest, sunrise, sunset);
        renderSunChart(dest.lat, dest.lng, base, sunrise, sunset);
        updateSunDirection(dest.lat, dest.lng, sunrise, sunset);
        fillCardTimes('rise', sunrise, RISE_OFF, +$('#sp-slider-rise').value);
        fillCardTimes('set' , sunset , SET_OFF , +$('#sp-slider-set').value);
        if(data.hourly){
          setWeatherOnly('rise', data.hourly, sunset);
          setWeatherOnly('set' , data.hourly, sunrise);
        }
        renderHourlyChart(data.hourly, dStr, false);
      })
      .catch(function(){ renderHourlyChart(null,dStr,false); });
  }

  function toggleRadar(enabled){
    if(!map) return;
    var overlays=map.overlayMapTypes;
    if(enabled){
      if(!radarLayer){
        radarLayer=new google.maps.ImageMapType({
          getTileUrl:function(coord,zoom){
            return 'https://tilecache.rainviewer.com/v2/radar/nowcast_0/256/'+zoom+'/'+coord.x+'/'+coord.y+'/2/1_1.png';
          },
          tileSize:new google.maps.Size(256,256),
          opacity:0.6,
          name:'Radar opadow'
        });
      }
      var exists=false;
      for(var i=0;i<overlays.getLength();i++){ if(overlays.getAt(i)===radarLayer){ exists=true; break; } }
      if(!exists) overlays.insertAt(0,radarLayer);
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
        var span=document.createElement('span'); span.textContent='Krotki link: ';
        var a=document.createElement('a'); a.href=url; a.target='_blank'; a.rel='noopener'; a.textContent=url;
        box.appendChild(span); box.appendChild(a);
      }
    }
    if(url){
      try{ navigator.clipboard.writeText(url); toast('Krotki link skopiowany','ok'); }
      catch(e){ toast('Krotki link gotowy','ok'); }
    }
  }
  function createShortLink(){
    if(!REST_URL){ toast('Funkcja skroconego linku niedostepna'); return; }
    var box=$('#sp-short-status'); if(box){ box.textContent='Generuje link...'; }
    fetch(REST_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sp:b64url.enc(packState())})})
      .then(function(r){ if(!r.ok) throw new Error('http'); return r.json(); })
      .then(function(data){ if(data && data.url){ setShortLink(data.url); } else { if(box) box.textContent='Nie udalo sie wygenerowac linku.'; } })
      .catch(function(){ if(box) box.textContent='Nie udalo sie wygenerowac linku.'; });
  }
  function formatICS(date){
    if(!(date instanceof Date) || isNaN(date)) return null;
    return date.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')+'Z';
  }
  function exportCalendar(){
    if(!lastSunData || !lastSunData.rise || !lastSunData.set || !lastSunData.date){ toast('Uzupelnij plan trasy.'); return; }
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
      'SUMMARY:Swit - '+destLabel,
      'LOCATION:'+(destLabel.replace(/\r?\n/g,' ')),
      'DESCRIPTION:Plan switu dla '+destLabel,
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:'+uidBase+'-set@sunplanner',
      'DTSTAMP:'+formatICS(new Date()),
      'DTSTART:'+setICS,
      'DTEND:'+formatICS(new Date(lastSunData.set.getTime()+3600000)),
      'SUMMARY:Zachod - '+destLabel,
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
    if(!w){ toast('Odblokuj wyskakujace okna.'); return; }
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
    var html='<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8"><title>Karta klienta</title><style>body{font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;color:#111;padding:24px;}h1{margin:0 0 12px;font-size:24px;}section{margin-bottom:20px;}table{width:100%;border-collapse:collapse;margin-top:12px;}td,th{border:1px solid #e5e7eb;padding:8px;text-align:left;}ul{padding-left:18px;}small{color:#6b7280;}</style></head><body>'+
      '<h1>Karta klienta – '+esc(dest.label||'Plan pleneru')+'</h1>'+
      '<section><strong>Data:</strong> '+esc(dEl.value||'—')+'<br><strong>Cel:</strong> '+esc(dest.label||'—')+'<br><strong>Dystans:</strong> '+esc(distTxt)+'<br><strong>Czas przejazdu:</strong> '+esc(timeTxt)+'</section>'+
      '<section><table><tr><th>Moment</th><th>Godzina</th><th>Azymut</th></tr><tr><td>Swit</td><td>'+esc(riseText)+'</td><td>'+(lastSunData.riseAz!=null?esc(lastSunData.riseAz+'°'):'—')+'</td></tr><tr><td>Zachod</td><td>'+esc(setTextVal)+'</td><td>'+(lastSunData.setAz!=null?esc(lastSunData.setAz+'°'):'—')+'</td></tr></table></section>'+
      '<section><h2>Punkty trasy</h2><ul>'+pointsHtml+'</ul></section>'+
      '<section><h2>Uwagi</h2><p>Notatki klienta:</p><div style="min-height:80px;border:1px solid #e5e7eb;border-radius:8px;"></div></section>'+
      '<small>Wygenerowano przez SunPlanner.</small>'+
      '</body></html>';
    w.document.write(html);
    w.document.close();
    setTimeout(function(){ try{w.focus(); w.print();}catch(e){} }, 400);
  }
  function locateStart(){
    if(!navigator.geolocation){ toast('Brak wsparcia geolokalizacji w przegladarce'); return; }
    navigator.geolocation.getCurrentPosition(function(pos){
      var lat=pos.coords.latitude, lng=pos.coords.longitude;
      function apply(label){
        var point={lat:lat,lng:lng,label:label||'Moja lokalizacja'};
        if(points.length){ points[0]=point; }
        else points.push(point);
        renderList(); recalcRoute(false); updateDerived(); loadGallery();
        toast('Zaktualizowano punkt startowy','ok');
      }
      if(geocoder){
        geocoder.geocode({location:{lat:lat,lng:lng}},function(res,st){
          if(st==='OK' && res && res[0]) apply(res[0].formatted_address); else apply('Moja lokalizacja');
        });
      } else apply('Moja lokalizacja');
    }, function(){ toast('Nie udalo sie pobrac lokalizacji'); }, {enableHighAccuracy:true,timeout:8000});
  }

  // galeria (tylko cel, 6 zdjec, link w nowym oknie)
  function loadGallery(){
    var dest=points[points.length-1]; var label=dest? (dest.label||'') : ''; var gal=$('#sp-gallery');
    if(!label){ gal.innerHTML=''; return; }
    gal.innerHTML='<div class="muted">Laduje zdjecia...</div>';

    function renderItems(items, makeUrl, makeThumb){
      gal.innerHTML='';
      items.forEach(function(it){
        var a=document.createElement('a'); a.href=makeUrl(it); a.target='_blank'; a.rel='noopener';
        var img=new Image(); img.src=makeThumb(it); img.loading='lazy'; img.alt=label+' - inspiracja';
        a.appendChild(img); gal.appendChild(a);
      });
      if(!gal.children.length) gal.innerHTML='<div class="muted">Brak zdjec.</div>';
    }

    if(CSE_ID){
      fetch('https://www.googleapis.com/customsearch/v1?key='+GMAPS_KEY+'&cx='+CSE_ID+'&searchType=image&num=6&q='+encodeURIComponent(label+' sesja slubna'))
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
              .catch(function(){ gal.innerHTML='<div class="muted">Blad galerii.</div>'; });
          }
        })
        .catch(function(){ gal.innerHTML='<div class="muted">Blad galerii.</div>'; });
    } else {
      fetch('https://api.unsplash.com/search/photos?per_page=6&query='+encodeURIComponent(label+' wedding shoot')+'&client_id='+UNSPLASH_KEY)
        .then(function(r){ return r.json(); })
        .then(function(d){
          var arr=(d && d.results)? d.results : [];
          renderItems(arr, function(p){ return (p.links && p.links.html) ? p.links.html : (p.urls && p.urls.regular ? p.urls.regular : '#'); }, function(p){ return p.urls.small; });
        })
        .catch(function(){ gal.innerHTML='<div class="muted">Blad galerii.</div>'; });
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
      toast('Wpisz nazwe miejsca lub kliknij na mapie, aby dodac punkt.');
    }
  });
  $('#sp-opt').addEventListener('click', function(){ recalcRoute(true); });
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
    var url = BASE_URL + '?sp=' + b64url.enc(packState());
    history.replaceState(null,'',url);
    var linkEl=$('#sp-link'); if(linkEl) linkEl.textContent = url;
    if(shortLinkValue){
      shortLinkValue=null;
      var box=$('#sp-short-status'); if(box) box.textContent='Plan zmieniony. Wygeneruj nowy krotki link.';
    }
    persistState();
  }

  // start
  function startApp(){ try{ updateSunWeather(); }catch(e){} if(window.google && window.google.maps){ initMap(); } }
  if(window.google && window.google.maps) startApp();
  window.addEventListener('sunplanner:gmaps-ready', startApp, { once:true });
})();
