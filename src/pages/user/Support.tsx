import { MessageCircle, Mail, HelpCircle } from 'lucide-react';

export function Support() {
  const faqs = [
    {
      q: '¿Cómo renuevo mi suscripción?',
      a: 'Ve a la sección "Membresía" desde tu perfil, sube el comprobante de tu pago y espera a que un administrador lo apruebe. Te llegará una notificación.'
    },
    {
      q: '¿Dónde encuentro los enlaces a las clases en vivo?',
      a: 'Los enlaces a las clases en vivo se publican como notificaciones y en el Dashboard bajo la sección de "Avisos importantes".'
    },
    {
      q: 'Un curso no me carga, ¿qué hago?',
      a: 'Asegúrate de estar usando una buena conexión a internet. Si el problema persiste, es probable que tu cuenta de Google no tenga permisos temporales en Drive. Contáctanos.'
    }
  ];

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-20">
      
      <div className="flex flex-col gap-1">
        <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Soporte y Ayuda</h2>
        <p className="text-gray-500 text-sm">Estamos aquí para ayudarte en tu proceso.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <a 
          href="https://wa.me/573206885172" 
          target="_blank" 
          rel="noreferrer"
          className="bg-green-50 rounded-[2rem] p-5 border border-green-100 flex flex-col items-center text-center gap-3 hover:bg-green-100 transition-colors"
        >
          <div className="w-12 h-12 bg-green-500 text-white rounded-full flex items-center justify-center shadow-sm">
            <MessageCircle size={24} />
          </div>
          <div>
            <h4 className="font-bold text-green-900 text-sm">WhatsApp</h4>
            <p className="text-[10px] text-green-700 mt-0.5">Respuesta rápida</p>
          </div>
        </a>

        <a 
          href="mailto:contacto@zentiaservices.top" 
          className="bg-blue-50 rounded-[2rem] p-5 border border-blue-100 flex flex-col items-center text-center gap-3 hover:bg-blue-100 transition-colors"
        >
          <div className="w-12 h-12 bg-blue-500 text-white rounded-full flex items-center justify-center shadow-sm">
            <Mail size={24} />
          </div>
          <div>
            <h4 className="font-bold text-blue-900 text-sm">Correo</h4>
            <p className="text-[10px] text-blue-700 mt-0.5">Soporte técnico</p>
          </div>
        </a>
      </div>

      <div className="bg-white/60 backdrop-blur-md rounded-3xl p-6 shadow-sm border border-white/80 mt-2">
        <div className="flex items-center gap-2 mb-6">
          <HelpCircle className="text-blue-500" size={24} />
          <h3 className="text-xl font-bold text-gray-900">Preguntas Frecuentes</h3>
        </div>

        <div className="flex flex-col gap-5">
          {faqs.map((faq, idx) => (
            <div key={idx} className="border-b border-gray-100 pb-5 last:border-0 last:pb-0">
              <h4 className="font-bold text-gray-900 text-sm mb-2">{faq.q}</h4>
              <p className="text-sm text-gray-600 leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
