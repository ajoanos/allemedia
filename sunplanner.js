/* SunPlanner v1.5.5 - bez optional chaining, bez nietypowych znakow w JS-stringach, poprawne godziny z Open-Meteo (fallback SunCalc), 3 trasy, blokada scrolla nad mapa, bez QR */
(function(){
  var CFG = window.SUNPLANNER_CFG || {};
  var GMAPS_KEY    = CFG.GMAPS_KEY || '';
  var CSE_ID       = CFG.CSE_ID || '';
  var UNSPLASH_KEY = CFG.UNSPLASH_KEY || '';
  var TZ           = CFG.TZ || (Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Warsaw');

  var root = document.getElementById('sunplanner-app');
  if(!root){ console.warn('SunPlanner: brak #sunplanner-app'); return; }

  root.innerHTML =
  '<div class="sunplanner">'+
    '<div id="sp-toast" class="banner" style="display:none"></div>'+
    '<div class="row">'+
      '<input id="sp-place" class="input" placeholder="Dodaj punkt: Start / Przystanek / Cel">'+
      '<button id="sp-add" class="btn" type="button">Dodaj</button>'+
      '<input id="sp-date" class="input" type="date" style="max-width:170px">'+
      '<button id="sp-clear" class="btn secondary" type="button">Wyczysc</button>'+
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

        '<h3 style="margin-top:1rem">Udostepnij / Eksport</h3>'+
        '<div class="row" style="align-items:center">'+
          '<div class="col" style="flex:1">'+
            '<div class="row" style="gap:.35rem">'+
              '<button id="sp-copy" class="btn secondary" type="button">Kopiuj link</button>'+
              '<button id="sp-print" class="btn secondary" type="button">Drukuj / PDF</button>'+
            '</div>'+
            '<div class="muted" id="sp-link" style="margin-top:.25rem;word-break:break-all"></div>'+
          '</div>'+
        '</div>'+

        '<div class="card" style="margin-top:1rem;padding:.75rem">'+
          '<h3>Galeria inspiracji</h3>'+
          '<div id="sp-gallery"></div>'+
        '</div>'+
      '</div>'+
    '</div>'+
  '</div>';

  // helpers (bez unicode w komunikatach)
  function $(s){ return document.querySelector(s); }
  function toast(m,type){ var t=$("#sp-toast"); t.textContent=m; t.style.display='block'; t.style.background=(type==='ok'?'#dcfce7':'#fee2e2'); t.style.color=(type==='ok'?'#14532d':'#991b1b'); clearTimeout(toast._t); toast._t=setTimeout(function(){t.style.display='none';}, 4200); }
  function fmt(d){ return d.toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'}); }
  function setText(id,v){ var el=(id.charAt(0)==='#'?$(id):$('#'+id)); if(el) el.textContent=v; }

  // stan
  var map, geocoder, dirService, placesAutocomplete, dragMarker;
  var dirRenderers = [];
  var points = [];
  var driveMin = 0;
  var ctrlWeather = null, weatherReqId=0;

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
  function packState(){ return { date:dEl.value, sr:$('#sp-slider-rise').value, ss:$('#sp-slider-set').value, pts:points.map(function(p){return {lat:+p.lat,lng:+p.lng,label:p.label||'Punkt'};}) }; }
  function unpackState(obj){
    if(!obj) return;
    if(obj.date) dEl.value=obj.date;
    if(obj.sr) $('#sp-slider-rise').value=obj.sr;
    if(obj.ss) $('#sp-slider-set').value=obj.ss;
    if(Object.prototype.toString.call(obj.pts)==='[object Array]'){
      points = obj.pts.map(function(p){ return {lat:+p.lat,lng:+p.lng,label:p.label||'Punkt'}; });
    }
  }
  (function(){ var sp=new URLSearchParams(location.search).get('sp'); if(sp){ try{ unpackState(b64url.dec(sp)); }catch(e){ console.warn('SP decode',e); } } })();

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
    return { getTimes:getTimes };
  })();
  var SunCalc = (window.SunCalc && window.SunCalc.getTimes) ? window.SunCalc : SunCalcLite;

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
  function clearRenderers(){ dirRenderers.forEach(function(r){ r.setMap(null); }); dirRenderers=[]; }
  function recalcRoute(optimize){
    setText('sp-t-dist','—'); setText('sp-t-time','—');
    clearRenderers();
    if(!map || points.length<2){ updateSunWeather(); return; }

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
      if(!valid.length){ toast('Trasa niedostepna'); driveMin=0; updateSunWeather(); return; }
      var routes=[];
      if(!hasWps){
        routes = valid[0].routes.slice(0,3);
        routes.forEach(function(_,idx){
          var ren=new google.maps.DirectionsRenderer({
            map:map, directions: valid[0], routeIndex: idx,
            polylineOptions: { strokeColor: ['#e94244','#1e3a8a','#6b7280'][idx]||'#6b7280', strokeWeight: [6,5,4][idx]||4, strokeOpacity:[0.95,0.7,0.55][idx]||0.55 },
            suppressMarkers: idx>0, preserveViewport: idx>0
          });
          dirRenderers.push(ren);
        });
      } else {
        var colors=['#e94244','#1e3a8a','#6b7280'];
        valid.slice(0,3).forEach(function(res,idx){
          var ren=new google.maps.DirectionsRenderer({
            map:map, directions: res, routeIndex: 0,
            polylineOptions:{ strokeColor: colors[idx], strokeWeight:[6,5,4][idx], strokeOpacity:[0.95,0.7,0.55][idx] },
            suppressMarkers: idx>0, preserveViewport: idx>0
          });
          dirRenderers.push(ren);
        });
        routes = valid[0].routes;
      }

      var legs=routes[0].legs||[];
      var dist=legs.reduce(function(a,l){return a+(l.distance?l.distance.value:0);},0);
      var dura=legs.reduce(function(a,l){return a+(l.duration?l.duration.value:0);},0);
      setText('sp-t-dist',(dist/1000).toFixed(1)+' km');
      var min=Math.round(dura/60), h=Math.floor(min/60), m=min%60;
      setText('sp-t-time',(h? h+' h ':'')+m+' min');
      driveMin=Math.round((legs[0] && legs[0].duration ? legs[0].duration.value:0)/60);
      updateSunWeather();
    }).catch(function(){ toast('Trasa niedostepna'); driveMin=0; updateSunWeather(); });
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

  function updateSunWeather(){
    var dest=points[points.length-1], dStr=dEl.value;
    setText('sp-rise-date', dStr||''); setText('sp-set-date', dStr||'');
    if(!dest || !dStr) return;

    var base=dateFromInput(dStr);
    var b=bands(dest.lat, dest.lng, base);
    function rng(a,b){ return fmt(a)+'–'+fmt(b); }
    setText('sp-gold-am','Zlota '+rng(b.bluePM[0],b.bluePM[1])); // swit pokazuje wieczor
    setText('sp-blue-am','Niebieska '+rng(b.goldPM[0],b.goldPM[1]));
    setText('sp-gold-pm','Zlota '+rng(b.blueAM[0],b.blueAM[1])); // zachod pokazuje poranek
    setText('sp-blue-pm','Niebieska '+rng(b.goldAM[0],b.goldAM[1]));

    // fallback SunCalc
    var t=SunCalc.getTimes(base, dest.lat, dest.lng);
    var sunrise=t.sunrise, sunset=t.sunset;

    // pobierz Open-Meteo
    var myId=++weatherReqId; if(ctrlWeather && ctrlWeather.abort){ try{ctrlWeather.abort();}catch(e){} } ctrlWeather=new AbortController();
    fetch('https://api.open-meteo.com/v1/forecast?latitude='+dest.lat+'&longitude='+dest.lng+'&daily=sunrise,sunset&hourly=temperature_2m,cloudcover,wind_speed_10m,relative_humidity_2m,visibility,precipitation&timezone='+encodeURIComponent(TZ)+'&start_date='+dStr+'&end_date='+dStr, {signal:ctrlWeather.signal})
      .then(function(r){ if(myId!==weatherReqId) return Promise.reject(); if(!r.ok) return Promise.reject(); return r.json(); })
      .then(function(data){
        if(myId!==weatherReqId) return;
        var sr = (data && data.daily && data.daily.sunrise && data.daily.sunrise[0]) ? parseLocalISO(data.daily.sunrise[0]) : null;
        var ss = (data && data.daily && data.daily.sunset  && data.daily.sunset [0]) ? parseLocalISO(data.daily.sunset [0]) : null;
        if(sr instanceof Date && !isNaN(sr)) sunrise=sr;
        if(ss instanceof Date && !isNaN(ss)) sunset=ss;

        // czasy
        fillCardTimes('rise', sunrise, RISE_OFF, +$('#sp-slider-rise').value);
        fillCardTimes('set' , sunset , SET_OFF , +$('#sp-slider-set').value);

        // meteo krzyzowo
        setWeatherOnly('rise', (data?data.hourly:null), sunset);
        setWeatherOnly('set' , (data?data.hourly:null), sunrise);
      })
      .catch(function(){
        // fallback bez meteo
        fillCardTimes('rise', sunrise, RISE_OFF, +$('#sp-slider-rise').value);
        fillCardTimes('set' , sunset , SET_OFF , +$('#sp-slider-set').value);
        ['rise','set'].forEach(function(p){ ['t','c','w','h','v','p'].forEach(function(k){ setText('sp-'+p+'-'+k,'—'); }); });
      });
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

    renderList(); updateDerived();
    if(points.length>=2) recalcRoute(false); else updateSunWeather();
    loadGallery(); updateLink();

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
    points=[]; renderList(); clearRenderers();
    setText('sp-t-time','—'); setText('sp-t-dist','—'); setText('sp-loc','—');
    loadGallery(); updateSunWeather(); updateLink();
  });
  $('#sp-copy').addEventListener('click', function(){ updateLink(); try{ navigator.clipboard.writeText(location.href); }catch(e){} });
  $('#sp-print').addEventListener('click', function(){ window.print(); });
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
    var url = location.origin + location.pathname + '?sp=' + b64url.enc(packState());
    history.replaceState(null,'',url);
    $('#sp-link').textContent = url;
  }

  // start
  function startApp(){ try{ updateSunWeather(); }catch(e){} if(window.google && window.google.maps){ initMap(); } }
  if(window.google && window.google.maps) startApp();
  window.addEventListener('sunplanner:gmaps-ready', startApp, { once:true });
})();
