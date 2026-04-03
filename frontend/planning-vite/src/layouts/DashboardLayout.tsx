import type { PropsWithChildren } from 'react';



import { useMemo, useState } from 'react';



import { Link, useLocation } from 'react-router-dom';



import { useAuth } from '../context/AuthContext';



import logo from '../assets/moa planinig logo.png';







// Move Icon component outside for better performance



const MenuIcon = ({ name, active }: { name: string; active?: boolean }) => {



  const color = active ? 'text-green-700' : 'text-white/90';



  



  switch (name) {



    case 'Home':



      return (



        <svg className={`w-[22px] h-[22px] ${color}`} fill="currentColor" viewBox="0 0 24 24">



          <path d="M12 3 2 12h3v8h6v-5h2v5h6v-8h3L12 3Z"/>



        </svg>



      );



    case 'Users':



      return (



        <svg className={`w-[22px] h-[22px] ${color}`} fill="none" viewBox="0 0 24 24">



          <path d="M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0Zm-4 6c-4.418 0-8 2.239-8 5v1h16v-1c0-2.761-3.582-5-8-5Z"/>



        </svg>



      );



    case 'Sectors':



      return (



        <svg className={`w-[22px] h-[22px] ${color}`} fill="currentColor" viewBox="0 0 24 24">



          <path d="M3 10h8V3H3v7Zm10 11h8v-7h-8v7ZM3 21h8v-7H3v7Zm10-11h8V3h-8v7Z"/>



        </svg>



      );



    case 'Departments':



      return (



        <svg className={`w-[22px] h-[22px] ${color}`} fill="currentColor" viewBox="0 0 24 24">



          <path d="M3 3h18v4H3V3Zm0 6h18v4H3V9Zm0 6h18v4H3v-4Z"/>



        </svg>



      );



    case 'Indicators':



      return (



        <svg className={`w-[22px] h-[22px] ${color}`} fill="currentColor" viewBox="0 0 24 24">



          <path d="M3 13h4v8H3v-8Zm7-6h4v14h-4V7Zm7 3h4v11h-4V10Z"/>



        </svg>



      );



    case 'Annual Plans':



      return (



        <svg className={`w-[22px] h-[22px] ${color}`} fill="currentColor" viewBox="0 0 24 24">



          <path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm8 1.5V8h4.5L14 3.5Z"/>



        </svg>



      );



    case 'Entry Periods':



      return (



        <svg className={`w-[22px] h-[22px] ${color}`} fill="currentColor" viewBox="0 0 24 24">



          <path d="M7 2h10a2 2 0 0 1 2 2v3H5V4a2 2 0 0 1 2-2Zm-2 7h14v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9Zm3 3v2h8v-2H8Z"/>



        </svg>



      );



    case 'Quarterly Breakdown':



      return (



        <svg className={`w-[22px] h-[22px] ${color}`} fill="currentColor" viewBox="0 0 24 24">



          <path d="M3 5h18v2H3V5Zm0 6h10v2H3v-2Zm0 6h14v2H3v-2Z"/>



        </svg>



      );



    case 'Quarterly Performance':



      return (



        <svg className={`w-[22px] h-[22px] ${color}`} fill="currentColor" viewBox="0 0 24 24">



          <path d="M4 19h16v2H4v-2Zm2-8h3v6H6v-6Zm5-4h3v10h-3V7Zm5 2h3v8h-3V9Z"/>



        </svg>



      );



    case 'State Minister Dashboard':



      return (



        <svg className={`w-[22px] h-[22px] ${color}`} fill="currentColor" viewBox="0 0 24 24">



          <path d="M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10-8h8V3h-8v10Zm0 8h8v-6h-8v6Z"/>



        </svg>



      );



    case 'Reviews & Approvals':



      return (



        <svg className={`w-[22px] h-[22px] ${color}`} fill="currentColor" viewBox="0 0 24 24">



          <path d="M3 3h18v14H7l-4 4V3Zm4 6h10V7H7v2Zm0 4h6v-2H7v2Z"/>



        </svg>



      );



    case 'Validations':



      return (



        <svg className={`w-[22px] h-[22px] ${color}`} fill="currentColor" viewBox="0 0 24 24">



          <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z"/>



        </svg>



      );



    case 'Overall Dashboard':



      return (



        <svg className={`w-[22px] h-[22px] ${color}`} fill="currentColor" viewBox="0 0 24 24">



          <path d="M3 3h18v18H3V3Zm2 2v14h14V5H7Zm2 10h2V9H7v6Zm4 0h2V7h-2v8Zm4 0h2v-4h-2v4Z"/>



        </svg>



      );



    case 'Spreadsheet':



      return (



        <svg className={`w-[22px] h-[22px] ${color}`} fill="currentColor" viewBox="0 0 24 24">



          <path d="M3 3h18v18H3V3zm2 2v4h6V5H5zm8 0v4h6V5h-6zM5 11v4h6v-4H5zm8 0v4h6v-4h-6zM5 17v2h6v-2H5zm8 0v2h6v-2h-6z"/>



        </svg>



      );



    case 'Activity Log':



      return (



        <svg className={`w-[22px] h-[22px] ${color}`} fill="currentColor" viewBox="0 0 24 24">



          <path d="M5 4h14v2H5V4Zm0 5h9v2H5V9Zm0 5h14v2H5v-2Z"/>



        </svg>



      );



    case 'Profile':



      return (



        <svg className={`w-[22px] h-[22px] ${color}`} fill="currentColor" viewBox="0 0 24 24">



          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>



        </svg>



      );



    case 'Minister View':



      return (



        <svg className={`w-[22px] h-[22px] ${color}`} fill="currentColor" viewBox="0 0 24 24">



          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>



        </svg>



      );



    case 'Detail Analysis':



      return (



        <svg className={`w-[22px] h-[22px] ${color}`} fill="currentColor" viewBox="0 0 24 24">



          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>



        </svg>



      );



    case 'Document Upload':



      return (



        <svg className={`w-[22px] h-[22px] ${color}`} fill="currentColor" viewBox="0 0 24 24">



          <path d="M9 16h6v-6h4l-7-7-7 7h4v6Zm-4 2h14v2H5v-2Z"/>



        </svg>



      );



    case 'Documents':



      return (



        <svg className={`w-[22px] h-[22px] ${color}`} fill="currentColor" viewBox="0 0 24 24">



          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm-1 1.5L18.5 9H13V3.5ZM8 13h8v1.5H8V13Zm0 3h5v1.5H8V16Zm0-6h3v1.5H8V10Z"/>



        </svg>



      );



    default:



      return (



        <svg className={`w-[22px] h-[22px] ${color}`} fill="currentColor" viewBox="0 0 24 24">



          <circle cx="12" cy="12" r="9"/>



        </svg>



      );



  }



};







// Mobile menu component



const MobileMenu = ({ 



  menus, 



  isOpen, 



  onClose 


}: { 

  menus: Array<{label: string; to: string}>;

  isOpen: boolean;

  onClose: () => void;

}) => {

  const location = useLocation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-0 top-0 h-full w-72 bg-gradient-to-b from-[#0f4a2c] to-[#1a7a45] text-white shadow-2xl">
        <div className="h-16 px-5 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="Logo" className="h-8 w-8 object-contain rounded-lg bg-white/95 p-0.5" />
            <span className="font-semibold text-sm text-white/95">MoA Planning</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4 text-white/60" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
        <nav className="px-3 py-4 space-y-0.5 overflow-y-auto">
          {menus.map((menu) => {
            const active = location.pathname === menu.to;
            return (
              <Link
                key={menu.to}
                to={menu.to}
                onClick={onClose}
                className={`relative flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 ${
                  active 
                    ? 'bg-white/15 text-white font-medium shadow-sm' 
                    : 'text-white/65 hover:bg-white/8 hover:text-white/90'
                }`}
              >
                {active && (
                  <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-emerald-300" />
                )}
                <MenuIcon name={menu.label} active={active} />
                <span className="text-sm">{menu.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
};

export default function DashboardLayout({ children }: PropsWithChildren) {
  const { user, logout } = useAuth();

  const role = (user?.role || '').toUpperCase();

  const isSuper = !!user?.is_superuser;

  const location = useLocation();

  const [collapsed, setCollapsed] = useState(false);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const menus = useMemo(() => {
    const common = [
      { label: 'Home', to: '/' },



      { label: 'Profile', to: '/profile' },



    ];



    const superMenus = [



      { label: 'Users', to: '/users' },



      { label: 'Sectors', to: '/sectors' },



      { label: 'Departments', to: '/departments' },



      { label: 'Indicators', to: '/indicators' },



      { label: 'Indicator Groups', to: '/indicator-groups' },



      { label: 'Annual Plans', to: '/annual-plans' },



      { label: 'Entry Periods', to: '/entry-periods' },



    ];



    const advisorMenus = [



      { label: 'Quarterly Breakdown', to: '/quarterly-breakdowns' },



      { label: 'Quarterly Performance', to: '/performances' },



      { label: 'Advisor Overall Comment', to: '/advisor-comment' },



      { label: 'Document Upload', to: '/document-upload' },



      { label: 'Documents', to: '/documents' },



    ];



    const leadExecutiveMenus = [



      { label: 'Quarterly Breakdown', to: '/quarterly-breakdowns' },



      { label: 'Quarterly Performance', to: '/performances' },



      { label: 'Advisor Comments', to: '/advisor-comments' },



      { label: 'Spreadsheet', to: '/spreadsheet' },



      { label: 'Document Upload', to: '/document-upload' },



    ];



    const ministerMenus = [



      { label: 'State Minister Dashboard', to: '/state-minister-dashboard' },



      { label: 'Reviews & Approvals', to: '/reviews' },



      { label: 'Advisor Comments', to: '/advisor-comments' },



      { label: 'Spreadsheet', to: '/spreadsheet' },



      { label: 'Documents', to: '/documents' },



    ];



    const strategicMenus = [



      { label: 'Validations', to: '/validations' },



      { label: 'Spreadsheet', to: '/spreadsheet' },



      { label: 'Documents', to: '/documents' },



    ];



    const executiveMenus = [



      { label: 'Final Approvals', to: '/final-approvals' },



      { label: 'Spreadsheet', to: '/spreadsheet' },



      { label: 'Documents', to: '/documents' },



    ];



    const ministerViewMenus = [



      { label: 'Dashboard', to: '/minister-view' },


      { label: 'Overall Dashboard', to: '/overall-dashboard' },


      { label: 'Detail Analysis', to: '/detail-analysis' },


    ];



    // For MINISTER_VIEW role, put Dashboard first and omit Home entry
    if (role === 'MINISTER_VIEW') {
      const filteredCommon = common.filter((item) => item.label !== 'Home');
      return [...ministerViewMenus, ...filteredCommon];
    }



    const out = [...common];



    if (isSuper) out.push(...superMenus);



    if (role === 'ADVISOR') out.push(...advisorMenus);



    if (role === 'LEAD_EXECUTIVE_BODY') out.push(...leadExecutiveMenus);



    if (role === 'STATE_MINISTER') out.push(...ministerMenus);



    if (role === 'STRATEGIC_STAFF') out.push(...strategicMenus);



    if (role === 'EXECUTIVE') out.push(...executiveMenus);



    if (isSuper || role === 'STRATEGIC_STAFF' || role === 'EXECUTIVE') {



      out.push({ label: 'Activity Log', to: '/activity-logs' });



    }







    return out;



  }, [role, isSuper]);







  return (



    <div className="min-h-screen flex bg-gradient-to-br from-gray-50 to-gray-100">



      {/* Mobile Menu */}



      <MobileMenu 



        menus={menus} 



        isOpen={mobileMenuOpen} 



        onClose={() => setMobileMenuOpen(false)} 



      />







      {/* Desktop Sidebar */}



      <aside



        className={`${



          collapsed ? 'w-[72px]' : 'w-64'



        } hidden md:flex flex-col bg-gradient-to-b from-[#0f4a2c] to-[#1a7a45] text-white shadow-2xl transition-all duration-300 ease-in-out fixed top-0 left-0 h-screen z-30`}



      >



        {/* Sidebar Header */}



        <div className={`h-16 flex items-center border-b border-white/10 ${collapsed ? 'px-3 justify-center' : 'px-5'}`}>



          <div className="flex items-center gap-3">



            <img 



              src={logo} 



              alt="Logo" 



              className="h-9 w-9 object-contain rounded-lg bg-white/95 p-1 shadow-sm flex-shrink-0" 



            />



            {!collapsed && (



              <div className="flex flex-col min-w-0">



                <h2 className="font-semibold text-sm tracking-wide text-white/95 truncate">MoA Planning</h2>



                <span className="text-[10px] text-white/50 uppercase tracking-widest">Dashboard</span>



              </div>



            )}



          </div>



        </div>







        {/* Navigation */}



        <nav className={`flex-1 py-4 space-y-0.5 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 ${collapsed ? 'px-2' : 'px-3'}`}>



          {menus.map((menu) => {



            const active = location.pathname === menu.to;



            return (



              <Link



                key={menu.to}



                to={menu.to}



                className={`relative flex items-center gap-3 py-3 rounded-lg transition-all duration-200 group ${



                  collapsed ? 'px-2.5 justify-center' : 'px-3'



                } ${



                  active



                    ? 'bg-white/15 text-white font-medium shadow-sm'



                    : 'text-white/65 hover:bg-white/8 hover:text-white/90'



                }`}



                title={collapsed ? menu.label : ''}



              >



                {active && (



                  <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-emerald-300" />



                )}



                <MenuIcon name={menu.label} active={active} />



                {!collapsed && (



                  <span className="text-sm truncate">{menu.label}</span>



                )}



              </Link>



            );



          })}



        </nav>







        {/* Sidebar Footer */}



        <div className={`border-t border-white/10 ${collapsed ? 'p-2' : 'p-3'}`}>



          {!collapsed && (



            <div className="mb-3 p-2.5 bg-white/5 rounded-lg border border-white/5">



              <div className="flex items-center gap-2.5">



                <div className="h-8 w-8 rounded-full bg-emerald-400/20 flex items-center justify-center text-emerald-300 text-xs font-bold flex-shrink-0">



                  {user?.username?.charAt(0).toUpperCase()}



                </div>



                <div className="min-w-0">



                  <p className="text-sm font-medium truncate text-white/90">{user?.username}</p>



                  <div className="flex items-center gap-1.5">



                    <span className="text-[10px] text-white/45 uppercase tracking-wide">{role}</span>



                    {isSuper && (



                      <span className="px-1.5 py-0.5 text-[9px] bg-amber-500/20 text-amber-300 rounded font-medium">



                        Admin



                      </span>



                    )}



                  </div>



                </div>



              </div>



            </div>



          )}







          <div className="flex gap-1.5">



            <button



              onClick={() => setCollapsed((c) => !c)}



              className={`flex items-center justify-center p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors ${



                collapsed ? 'w-full' : ''



              }`}



              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}



            >



              {collapsed ? (



                <svg className="w-4 h-4 text-white/60" fill="currentColor" viewBox="0 0 24 24">



                  <path d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>



                </svg>



              ) : (



                <svg className="w-4 h-4 text-white/60" fill="currentColor" viewBox="0 0 24 24">



                  <path d="M15.41 16.59 10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z"/>



                </svg>



              )}



            </button>







            {!collapsed && (



              <button



                onClick={logout}



                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-red-500/15 hover:text-red-300 text-white/60 transition-colors text-xs"



              >



                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">



                  <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>



                </svg>



                <span>Sign out</span>



              </button>



            )}



          </div>



        </div>



      </aside>







      {/* Main Content */}



      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${collapsed ? 'md:ml-[72px]' : 'md:ml-64'}`}>



        {/* Header */}



        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-gray-200/80">



          <div className="h-16 px-4 md:px-6 flex items-center justify-between">



            <div className="flex items-center gap-3">



              <button



                onClick={() => setMobileMenuOpen(true)}



                className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"



              >



                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">



                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />



                </svg>



              </button>



              <div className="flex items-center gap-3">



                <img 



                  src={logo} 



                  alt="Logo" 



                  className="h-9 w-9 md:hidden object-contain rounded-lg border border-gray-200 p-0.5" 



                />



                <div>



                  <h1 className="text-base font-bold text-gray-800">



                    Beyond Production! <span className="text-emerald-600">ከማምረት በላይ!</span>



                  </h1>



                  <p className="text-[11px] text-gray-400 hidden sm:block">Ministry of Agriculture — Planning & Monitoring System</p>



                </div>



              </div>



            </div>







            {/* User Info */}



            <div className="flex items-center gap-3">



              <div className="hidden md:flex items-center gap-3 bg-gray-50 rounded-full pl-4 pr-1.5 py-1.5">



                <div className="text-right">



                  <p className="text-sm font-medium text-gray-800 leading-tight">{user?.username}</p>



                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">{role}</p>



                </div>



                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">



                  {user?.username?.charAt(0).toUpperCase()}



                </div>



              </div>



              



              <button



                onClick={logout}



                className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"



                title="Logout"



              >



                <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 24 24">



                  <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>



                </svg>



              </button>



            </div>



          </div>



        </header>







        {/* Main Content Area */}



        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto bg-gray-50/50">



          <div className="max-w-7xl mx-auto">



            {children}



          </div>



        </main>







        {/* Footer */}



        <footer className="bg-white border-t border-gray-200/80 py-3 px-6">



          <div className="flex flex-col md:flex-row items-center justify-between text-xs text-gray-400">



            <p> {new Date().getFullYear()} Ministry of Agriculture. All rights reserved.</p>



            <div className="flex items-center gap-3 mt-1.5 md:mt-0">



              <span>v1.0.0</span>



              <span className="hidden md:inline text-gray-300">·</span>



              <span className="hidden md:inline">Planning & Monitoring System</span>



            </div>



          </div>



        </footer>



      </div>



    </div>



  );



}