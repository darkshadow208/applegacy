import { Outlet, useLocation } from 'react-router-dom';

export function AuthLayout() {
  const location = useLocation();
  
  let title = "Bienvenido de vuelta";
  let subtitle = "Ingresa a tu cuenta para continuar aprendiendo";

  if (location.pathname.includes('/register')) {
    title = "Crea tu cuenta";
    subtitle = "Únete a Legacy Academy y transforma tu futuro";
  } else if (location.pathname.includes('/pending')) {
    title = "Validación requerida";
    subtitle = "Solo un paso más para entrar a la academia";
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fafafa] selection:bg-black selection:text-white">
      {/* Abstract Background Element for a premium touch */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none flex justify-center">
        <div className="w-[800px] h-[800px] bg-gradient-to-tr from-gray-200 to-transparent rounded-full blur-3xl opacity-50 -top-48 absolute"></div>
      </div>
      
      <div className="w-full max-w-md p-10 bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 relative z-10 mx-4">
        <div className="flex flex-col items-center text-center mb-8">
          {/* Logo container */}
          <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center mb-6 overflow-hidden">
             <img src="/logo.png" alt="Legacy Academy Logo" className="w-full h-full object-cover" onError={(e) => {
               (e.target as HTMLImageElement).style.display = 'none';
               (e.target as HTMLImageElement).parentElement!.innerHTML = '<span class="text-white font-bold text-xl">LA</span>';
             }}/>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">{title}</h1>
          <p className="text-gray-500 mt-2 text-sm">{subtitle}</p>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
