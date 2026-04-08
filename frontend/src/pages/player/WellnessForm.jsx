import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const WELLNESS_LABELS = {
  fatiga: {
    title: 'Estado de Fatiga',
    labels: { 1: 'Muy fatigado', 2: 'Más fatigado de lo normal', 3: 'Normal', 4: 'Recuperado', 5: 'Muy recuperado' }
  },
  sueno_calidad: {
    title: 'Calidad del Sueño',
    labels: { 1: 'Insomnio', 2: 'Sueño inquieto', 3: 'Dificultad para conciliar', 4: 'Bueno', 5: 'Muy relajante' }
  },
  estres: {
    title: 'Nivel de Estrés',
    labels: { 1: 'Muy estresado', 2: 'Estresado', 3: 'Normal', 4: 'Relajado', 5: 'Muy relajado' }
  },
  motivacion: {
    title: '¿Cómo te sientes de animado?',
    labels: { 1: 'Muy desmotivado', 2: 'Mal genio', 3: 'Menos animado de lo normal', 4: 'Buen humor', 5: 'Muy animado' }
  },
  dano_muscular: {
    title: 'Daño Muscular General',
    labels: { 1: 'Muy dolorido', 2: 'Más dolor de lo normal', 3: 'Normal', 4: 'Buenas sensaciones', 5: 'Muy buenas sensaciones' }
  }
};

const HORAS_SUENO = ['-4', '4', '4.5', '5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10', '10+'];

const BODY_ZONES = [
  'Cabeza/Cuello', 'Hombro D', 'Hombro I',
  'Brazo/Codo D', 'Brazo/Codo I', 'Muñeca/Mano D', 'Muñeca/Mano I',
  'Pecho/Esternón', 'Espalda Alta', 'Lumbar',
  'Cadera/Glúteo D', 'Cadera/Glúteo I',
  'Muslo D', 'Muslo I', 'Rodilla D', 'Rodilla I',
  'Gemelo/Sóleo D', 'Gemelo/Sóleo I', 'Tobillo D', 'Tobillo I',
  'Pie D', 'Pie I'
];

const ENFERMEDAD_OPTIONS = [
  { value: 'no',        label: 'Sin enfermedad',       style: 'bg-emerald-50 border-emerald-200 text-emerald-700', active: 'bg-emerald-500 text-white border-emerald-500' },
  { value: 'resfriado', label: 'Resfriado/Catarro',    style: 'bg-slate-50 border-slate-200 text-slate-700',     active: 'bg-slate-500 text-white border-slate-500' },
  { value: 'gripe',     label: 'Gripe',                style: 'bg-slate-50 border-slate-200 text-slate-700',     active: 'bg-red-500 text-white border-red-500' },
  { value: 'digestivo', label: 'Prob. digestivos',     style: 'bg-slate-50 border-slate-200 text-slate-700',     active: 'bg-orange-500 text-white border-orange-500' },
  { value: 'otros',     label: 'Otros',                style: 'bg-slate-50 border-slate-200 text-slate-700',     active: 'bg-amber-500 text-white border-amber-500' },
];

const SENSACION_OPTIONS = [
  { value: 'muy_bien', label: 'Muy buenas sensaciones', active: 'bg-emerald-500 text-white', inactive: 'bg-emerald-50 border border-emerald-200 text-emerald-700' },
  { value: 'bien',     label: 'Buenas sensaciones',     active: 'bg-lime-500 text-white',    inactive: 'bg-lime-50 border border-lime-200 text-lime-700' },
  { value: 'normal',   label: 'Normal',                 active: 'bg-amber-400 text-white',   inactive: 'bg-amber-50 border border-amber-200 text-amber-700' },
  { value: 'mal',      label: 'Malas sensaciones',      active: 'bg-orange-500 text-white',  inactive: 'bg-orange-50 border border-orange-200 text-orange-700' },
  { value: 'muy_mal',  label: 'Muy malas sensaciones',  active: 'bg-red-500 text-white',     inactive: 'bg-red-50 border border-red-200 text-red-700' },
];

export default function WellnessForm() {
  const navigate = useNavigate();
  const today = new Date().toISOString().split('T')[0];
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [todaySession, setTodaySession] = useState(null);

  const [form, setForm] = useState({
    fatiga: 0, sueno_calidad: 0, sueno_horas: '', estres: 0, motivacion: 0, dano_muscular: 0,
    molestias_zonas: [], enfermedad: '', sensacion_proximo: '', entrenamiento_previo: null, otros_comentarios: ''
  });

  useEffect(() => {
    api.get('/wellness/today').then(r => { if (r.data.submitted) setSubmitted(true); });
    api.get('/sessions').then(r => {
      const s = r.data.find(s => s.date === today);
      setTodaySession(s || null);
    }).catch(() => {});
  }, []);

  function setField(field, val) { setForm(f => ({ ...f, [field]: val })); }

  function toggleZone(zone) {
    setForm(f => ({
      ...f,
      molestias_zonas: f.molestias_zonas.includes(zone)
        ? f.molestias_zonas.filter(z => z !== zone)
        : [...f.molestias_zonas, zone]
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    for (const key of ['fatiga', 'sueno_calidad', 'estres', 'motivacion', 'dano_muscular']) {
      if (!form[key]) return setError('Por favor completa todas las valoraciones');
    }
    if (!form.sueno_horas) return setError('Indica las horas de sueño');
    if (!form.enfermedad) return setError('Indica si tienes alguna enfermedad');
    if (!form.sensacion_proximo) return setError('Indica tu sensación cara al próximo entreno');
    if (form.entrenamiento_previo === null) return setError('Indica si has entrenado antes de esta sesión');
    setError('');
    setLoading(true);
    try {
      const horas = form.sueno_horas === '10+' ? 10.5 : form.sueno_horas === '-4' ? 3.5 : parseFloat(form.sueno_horas);
      await api.post('/wellness', {
        session_id: todaySession?.id || null,
        date: today,
        fatiga: form.fatiga, sueno_calidad: form.sueno_calidad, sueno_horas: horas,
        estres: form.estres, motivacion: form.motivacion, dano_muscular: form.dano_muscular,
        molestias_zonas: form.molestias_zonas,
        enfermedad: form.enfermedad,
        sensacion_proximo: form.sensacion_proximo,
        entrenamiento_previo: form.entrenamiento_previo,
        otros_comentarios: form.otros_comentarios || null
      });
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al enviar');
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="pb-20 sm:pb-0 flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center">
        <div className="w-20 h-20 bg-emerald-100 rounded-3xl flex items-center justify-center text-5xl">✅</div>
        <h2 className="text-2xl font-extrabold text-slate-800">¡Wellness enviado!</h2>
        <p className="text-slate-400">Gracias. Ya puedes cerrar esta pantalla.</p>
        <button onClick={() => navigate('/player')} className="btn-secondary mt-2">← Volver al inicio</button>
      </div>
    );
  }

  return (
    <div className="pb-24 sm:pb-6 space-y-4 max-w-lg mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Wellness Pre-Entreno</h1>
        <p className="text-slate-400 text-sm mt-1">Rellena antes del entrenamiento</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {Object.entries(WELLNESS_LABELS).map(([key, config]) => (
          <ScaleInput key={key} title={config.title} labels={config.labels} value={form[key]} onChange={v => setField(key, v)} />
        ))}

        {/* Horas de sueño */}
        <div className="card">
          <p className="font-bold text-slate-800 mb-3">Horas de Sueño</p>
          <div className="flex flex-wrap gap-2">
            {HORAS_SUENO.map(h => (
              <button
                key={h}
                type="button"
                onClick={() => setField('sueno_horas', h)}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all duration-150 active:scale-95 ${
                  form.sueno_horas === h
                    ? 'bg-red-500 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {h}h
              </button>
            ))}
          </div>
        </div>

        {/* 1. Molestias físicas */}
        <div className="card">
          <p className="font-bold text-slate-800">Molestias físicas</p>
          <p className="text-xs text-slate-400 mt-0.5 mb-3">Selecciona las zonas con molestia (puedes elegir varias)</p>
          <div className="flex flex-wrap gap-2">
            {BODY_ZONES.map(zone => (
              <button
                key={zone}
                type="button"
                onClick={() => toggleZone(zone)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 active:scale-95 border ${
                  form.molestias_zonas.includes(zone)
                    ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-orange-300'
                }`}
              >
                {zone}
              </button>
            ))}
          </div>
          {form.molestias_zonas.length > 0 && (
            <p className="text-xs text-orange-600 font-semibold mt-2">
              ⚠ {form.molestias_zonas.join(', ')}
            </p>
          )}
        </div>

        {/* 2. Enfermedad */}
        <div className="card">
          <p className="font-bold text-slate-800 mb-3">Enfermedad</p>
          <div className="flex flex-wrap gap-2">
            {ENFERMEDAD_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setField('enfermedad', opt.value)}
                className={`px-3 py-2 rounded-lg text-sm font-bold transition-all duration-150 active:scale-95 border ${
                  form.enfermedad === opt.value ? opt.active : opt.style
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Sensación cara al próximo entreno */}
        <div className="card">
          <p className="font-bold text-slate-800 mb-3">Sensación cara al próximo entreno</p>
          <div className="space-y-2">
            {SENSACION_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setField('sensacion_proximo', opt.value)}
                className={`w-full py-3 rounded-xl text-sm font-bold transition-all duration-150 active:scale-95 text-left px-4 ${
                  form.sensacion_proximo === opt.value ? opt.active + ' shadow-sm' : opt.inactive
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Entrenamiento previo */}
        <div className="card">
          <p className="font-bold text-slate-800 mb-3">¿Has entrenado antes de este entrenamiento?</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setField('entrenamiento_previo', true)}
              className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-150 active:scale-95 border ${
                form.entrenamiento_previo === true
                  ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                  : 'bg-amber-50 text-amber-700 border-amber-200 hover:border-amber-400'
              }`}
            >
              Sí
            </button>
            <button
              type="button"
              onClick={() => setField('entrenamiento_previo', false)}
              className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-150 active:scale-95 border ${
                form.entrenamiento_previo === false
                  ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:border-emerald-400'
              }`}
            >
              No
            </button>
          </div>
        </div>

        {/* 5. Otros comentarios */}
        <div className="card">
          <p className="font-bold text-slate-800 mb-2">Otros comentarios <span className="text-slate-400 font-normal text-sm">(opcional)</span></p>
          <textarea
            className="input resize-none"
            rows={3}
            placeholder="Cualquier otra cosa que quieras comentar..."
            value={form.otros_comentarios}
            onChange={e => setField('otros_comentarios', e.target.value)}
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm font-bold">
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Enviando...' : 'Enviar Wellness'}
        </button>
      </form>
    </div>
  );
}

function ScaleInput({ title, labels, value, onChange }) {
  return (
    <div className="card">
      <p className="font-bold text-slate-800 text-sm mb-3">{title}</p>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`flex-1 aspect-square rounded-xl text-lg font-extrabold transition-all duration-150 active:scale-90 ${
              value === n ? scaleColor(n) + ' shadow-md' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      {value > 0 && (
        <p className="text-xs text-slate-500 text-center mt-2 font-medium">{labels[value]}</p>
      )}
    </div>
  );
}

function scaleColor(n) {
  return {
    1: 'bg-red-500 text-white',
    2: 'bg-orange-500 text-white',
    3: 'bg-amber-400 text-white',
    4: 'bg-lime-500 text-white',
    5: 'bg-emerald-500 text-white'
  }[n];
}
