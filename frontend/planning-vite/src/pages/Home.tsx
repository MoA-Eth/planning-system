import { useEffect, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';

import homePic from '../assets/home_pic.jpg';

import { 

  BarChart3, 

  Target, 

  TrendingUp, 

  Users, 

  Award,

  ChevronRight,

  ArrowRight,

  Activity,

  CheckCircle,

  Mail,

  Phone,

  Clock,

  Shield

} from 'lucide-react';



interface FeatureCard {

  icon: React.ReactNode;

  title: string;

  description: string;

  color: string;

}



export default function Home() {

  const { user, logout } = useAuth();

  const navigate = useNavigate();

  const [activeFeature, setActiveFeature] = useState(0);

  const [heroLoaded, setHeroLoaded] = useState(false);



  // Feature cards data

  const features: FeatureCard[] = [

    {

      icon: <Target className="w-6 h-6" />,

      title: "Target Setting",

      description: "Define and track annual performance targets across all departments",

      color: "from-blue-500 to-cyan-500"

    },

    {

      icon: <TrendingUp className="w-6 h-6" />,

      title: "Performance Tracking",

      description: "Monitor real-time progress against strategic objectives",

      color: "from-emerald-500 to-green-500"

    },

    {

      icon: <Users className="w-6 h-6" />,

      title: "Collaboration",

      description: "Seamless coordination between departments and leadership",

      color: "from-purple-500 to-pink-500"

    },

    {

      icon: <Award className="w-6 h-6" />,

      title: "Recognition",

      description: "Identify and celebrate high-performing teams and individuals",

      color: "from-amber-500 to-orange-500"

    }

  ];



  useEffect(() => {

    // Trigger hero animation

    const timer = setTimeout(() => setHeroLoaded(true), 300);

    return () => clearTimeout(timer);

  }, []);



  const handleScrollTo = (sectionId: string) => {

    const el = document.getElementById(sectionId);

    if (el) {

      el.scrollIntoView({ behavior: 'smooth', block: 'start' });

    }

  };



  // Auto-rotate features

  useEffect(() => {

    const interval = setInterval(() => {

      setActiveFeature((prev) => (prev + 1) % features.length);

    }, 4000);

    return () => clearInterval(interval);

  }, [features.length]);



  return (

    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50">

      {/* Header with glass effect */}

      <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">

          <div className="flex items-center space-x-3">

            <div className="bg-gradient-to-r from-emerald-600 to-green-600 w-10 h-10 rounded-xl flex items-center justify-center">

              <BarChart3 className="w-6 h-6 text-white" />

            </div>

            <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-700 to-green-700 bg-clip-text text-transparent">

              AgriPerformance

            </h1>

          </div>

          <div className="flex items-center gap-4">

            <div className="hidden md:flex items-center gap-6">

              <button 

                onClick={() => handleScrollTo('features')}

                className="text-sm font-medium text-gray-600 hover:text-emerald-600 transition-colors"

              >

                Features

              </button>

              <button 

                onClick={() => handleScrollTo('about')}

                className="text-sm font-medium text-gray-600 hover:text-emerald-600 transition-colors"

              >

                About

              </button>

              <button 

                onClick={() => handleScrollTo('contact')}

                className="text-sm font-medium text-gray-600 hover:text-emerald-600 transition-colors"

              >

                Contact

              </button>

            </div>

            <div className="flex items-center gap-3">

              <div className="text-right">

                <p className="text-sm font-medium text-gray-900">{user?.username}</p>

                <p className="text-xs text-gray-500">

                  {user?.role?.replace(/_/g, ' ') || 'User'}

                </p>

              </div>

              <button

                onClick={logout}

                className="px-4 py-2 bg-gradient-to-r from-gray-900 to-gray-800 text-white text-sm font-medium rounded-xl hover:shadow-lg hover:-translate-y-0.5 transform transition-all duration-200"

              >

                Logout

              </button>

            </div>

          </div>

        </div>

      </header>



      {/* Main Content */}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Hero Section with Parallax Effect */}

        <section className="relative mb-16 overflow-hidden rounded-3xl">

          <div className={`absolute inset-0 transition-all duration-1000 transform ${heroLoaded ? 'scale-110' : 'scale-100'}`}>

            <img

              src={homePic}

              alt="Agriculture landscape"

              className="w-full h-[500px] object-cover"

              onLoad={() => setHeroLoaded(true)}

            />

            <div className="absolute inset-0 bg-gradient-to-r from-emerald-900/90 via-emerald-800/70 to-transparent" />

          </div>

          

          <div className="relative z-10 p-8 md:p-12 lg:p-16 h-[500px] flex flex-col justify-center">

            <div className={`transform transition-all duration-700 delay-300 ${

              heroLoaded ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'

            }`}>

              <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-emerald-100 text-xs font-medium mb-6">

                <Activity className="w-3 h-3 mr-2" />

                PLANNING & PERFORMANCE MANAGEMENT SYSTEM

              </span>

              

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 leading-tight">

                Transforming Agriculture

                <br />

                <span className="text-emerald-200">Through Data-Driven Excellence</span>

              </h1>

              

              <p className="text-lg text-emerald-50/90 mb-8 max-w-2xl">

                Empowering sustainable agricultural growth through intelligent planning, 

                real-time performance tracking, and transparent accountability across all levels.

              </p>

              

              <div className="flex flex-wrap gap-4">

                <button

                  onClick={() => handleScrollTo('features')}

                  className="group px-6 py-3 bg-white text-emerald-900 rounded-xl font-semibold hover:shadow-2xl hover:-translate-y-1 transform transition-all duration-300 flex items-center"

                >

                  Explore Features

                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />

                </button>

                <button

                  onClick={() => handleScrollTo('contact')}

                  className="px-6 py-3 border-2 border-white/40 text-white rounded-xl font-semibold hover:bg-white/10 hover:border-white/60 transition-all duration-300"

                >

                  Get Started

                </button>

              </div>

            </div>

          </div>

        </section>



        {/* Features Section */}

        <section id="features" className="mb-16">

          <div className="text-center mb-12">

            <h2 className="text-3xl font-bold text-gray-900 mb-4">

              Everything You Need for <span className="text-emerald-600">Effective Planning</span>

            </h2>

            <p className="text-gray-600 max-w-2xl mx-auto">

              Our platform provides comprehensive tools to streamline agricultural planning, 

              monitoring, and evaluation processes

            </p>

          </div>



          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">

            {features.map((feature, index) => (

              <div

                key={index}

                className={`relative p-6 rounded-2xl border transition-all duration-500 cursor-pointer ${

                  activeFeature === index 

                    ? 'bg-gradient-to-br ' + feature.color + ' text-white shadow-2xl transform -translate-y-2' 

                    : 'bg-white hover:shadow-lg'

                }`}

                onMouseEnter={() => setActiveFeature(index)}

              >

                <div className={`mb-4 p-3 rounded-xl w-fit ${

                  activeFeature === index ? 'bg-white/20' : 'bg-emerald-50'

                }`}>

                  {feature.icon}

                </div>

                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>

                <p className={`text-sm ${activeFeature === index ? 'text-white/90' : 'text-gray-600'}`}>

                  {feature.description}

                </p>

                <ChevronRight className={`absolute right-6 bottom-6 w-5 h-5 ${

                  activeFeature === index ? 'opacity-100' : 'opacity-0'

                } transition-opacity`} />

              </div>

            ))}

          </div>



          {/* Feature Preview */}

          <div className="bg-gradient-to-r bg-[#453D36] rounded-3xl p-8 text-white">

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">

              <div>

                <h3 className="text-2xl font-bold mb-4">

                  {features[activeFeature].title}

                </h3>

                <p className="text-emerald-100/90 mb-6">

                  {features[activeFeature].description}

                </p>

                <div className="flex gap-4 mb-6">

                  <div className="flex-1 bg-white/10 rounded-xl p-4">

                    <div className="text-2xl font-bold">98%</div>

                    <div className="text-sm text-emerald-200/80">Accuracy Rate</div>

                  </div>

                  <div className="flex-1 bg-white/10 rounded-xl p-4">

                    <div className="text-2xl font-bold">24/7</div>

                    <div className="text-sm text-emerald-200/80">Real-time Monitoring</div>

                  </div>

                </div>

                <button className="px-6 py-3 bg-white text-emerald-900 rounded-xl font-semibold hover:shadow-lg transition-shadow">

                  Learn More

                </button>

              </div>

              <div className="relative">

                <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">

                  <div className="flex items-center justify-between mb-6">

                    <div>

                      <div className="text-sm text-emerald-200/80">Current Feature</div>

                      <div className="text-xl font-bold">{features[activeFeature].title}</div>

                    </div>

                    <div className="flex space-x-2">

                      {features.map((_, idx) => (

                        <button

                          key={idx}

                          onClick={() => setActiveFeature(idx)}

                          className={`w-2 h-2 rounded-full ${

                            activeFeature === idx ? 'bg-white' : 'bg-white/30'

                          }`}

                        />

                      ))}

                    </div>

                  </div>

                  <div className="space-y-4">

                    {[1, 2, 3].map((i) => (

                      <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">

                        <div className="flex items-center">

                          <CheckCircle className="w-4 h-4 text-emerald-400 mr-3" />

                          <span>Feature Benefit {i}</span>

                        </div>

                        <div className="text-emerald-300">+{i * 25}%</div>

                      </div>

                    ))}

                  </div>

                </div>

              </div>

            </div>

          </div>

        </section>



        {/* About Section */}

        <section

          id="about"

          className="mb-16 bg-white rounded-3xl shadow-xl border border-emerald-100 overflow-hidden"

        >

          <div className="grid grid-cols-1 lg:grid-cols-2">

            <div className="p-10">

              <h3 className="text-3xl font-bold text-gray-900 mb-6">

                Transforming Agricultural Planning

              </h3>

              <div className="space-y-4 text-gray-600 mb-8">

                <p>

                  Our platform serves as the central nervous system for the Ministry of Agriculture's 

                  strategic planning and performance management. We bridge the gap between policy objectives 

                  and on-ground implementation through data-driven insights.

                </p>

                <p>

                  By consolidating sector plans, annual targets, and performance reports, we create a single 

                  source of truth that empowers stakeholders at every level—from field officers to ministers.

                </p>

              </div>

              

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">

                <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-5 border border-emerald-100">

                  <div className="text-2xl font-bold text-emerald-700 mb-2">360°</div>

                  <div className="text-sm font-semibold text-emerald-800 mb-1">Transparency</div>

                  <p className="text-xs text-gray-600">Complete visibility across all departments and projects</p>

                </div>

                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-5 border border-blue-100">

                  <div className="text-2xl font-bold text-blue-700 mb-2">100%</div>

                  <div className="text-sm font-semibold text-blue-800 mb-1">Alignment</div>

                  <p className="text-xs text-gray-600">Direct linkage with national agricultural priorities</p>

                </div>

                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-5 border border-purple-100">

                  <div className="text-2xl font-bold text-purple-700 mb-2">24/7</div>

                  <div className="text-sm font-semibold text-purple-800 mb-1">Accountability</div>

                  <p className="text-xs text-gray-600">Continuous monitoring and follow-up capabilities</p>

                </div>

              </div>

            </div>

            

            <div className="relative min-h-[400px] bg-gradient-to-br from-emerald-600 to-green-700">

              <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>

              <div className="relative h-full p-10 flex flex-col justify-center text-emerald-50">

                <div className="mb-8">

                  <h4 className="text-xl font-bold mb-4">Core Capabilities</h4>

                  <ul className="space-y-4">

                    <li className="flex items-start gap-3">

                      <div className="mt-1 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">

                        <CheckCircle className="w-3 h-3" />

                      </div>

                      <span>Multi-year strategic planning with dynamic forecasting</span>

                    </li>

                    <li className="flex items-start gap-3">

                      <div className="mt-1 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">

                        <CheckCircle className="w-3 h-3" />

                      </div>

                      <span>Real-time performance dashboards with drill-down capabilities</span>

                    </li>

                    <li className="flex items-start gap-3">

                      <div className="mt-1 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">

                        <CheckCircle className="w-3 h-3" />

                      </div>

                      <span>Automated reporting and compliance monitoring</span>

                    </li>

                    <li className="flex items-start gap-3">

                      <div className="mt-1 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">

                        <CheckCircle className="w-3 h-3" />

                      </div>

                      <span>Predictive analytics for risk assessment and opportunity identification</span>

                    </li>

                  </ul>

                </div>

              </div>

            </div>

          </div>

        </section>



        {/* Contact Section */}

        <section

          id="contact"

          className="mb-8 rounded-3xl bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-800 overflow-hidden shadow-2xl"

        >

          <div className="grid grid-cols-1 lg:grid-cols-2">

            <div className="p-10 lg:p-12">

              <h3 className="text-3xl font-bold text-white mb-6">Get in Touch</h3>

              <p className="text-emerald-50/90 mb-8 text-lg">

                Our dedicated support team is here to help you maximize the platform's potential 

                for your agricultural planning needs.

              </p>

              

              <div className="space-y-6">

                <div className="flex items-start gap-4">

                  <div className="p-3 bg-white/10 rounded-xl">

                    <Mail className="w-6 h-6 text-emerald-200" />

                  </div>

                  <div>

                    <div className="text-sm font-semibold text-emerald-200 mb-1">Email</div>

                    <div className="text-white">planning.performance@moa.gov</div>

                  </div>

                </div>

                

                <div className="flex items-start gap-4">

                  <div className="p-3 bg-white/10 rounded-xl">

                    <Phone className="w-6 h-6 text-emerald-200" />

                  </div>

                  <div>

                    <div className="text-sm font-semibold text-emerald-200 mb-1">Phone</div>

                    <div className="text-white">+251-000-000-000</div>

                  </div>

                </div>

                

                <div className="flex items-start gap-4">

                  <div className="p-3 bg-white/10 rounded-xl">

                    <Clock className="w-6 h-6 text-emerald-200" />

                  </div>

                  <div>

                    <div className="text-sm font-semibold text-emerald-200 mb-1">Working Hours</div>

                    <div className="text-white">Monday – Friday, 8:30 am – 5:30 pm</div>

                  </div>

                </div>

              </div>

              

              <button className="mt-8 px-8 py-3 bg-white text-emerald-900 rounded-xl font-semibold hover:shadow-2xl hover:-translate-y-1 transform transition-all duration-300">

                Contact Support

              </button>

            </div>

            

            <div className="bg-gradient-to-br from-emerald-700/20 to-emerald-900/20 p-10 lg:p-12 border-l border-emerald-500/20">

              <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-emerald-500/20 p-8">

                <div className="flex items-center gap-3 mb-6">

                  <Shield className="w-6 h-6 text-emerald-300" />

                  <h4 className="text-xl font-semibold text-white">Important Notice</h4>

                </div>

                

                <div className="space-y-4 text-emerald-50/90">

                  <p>

                    This is a secure internal system for Ministry of Agriculture personnel only. 

                    All data is encrypted and access is strictly controlled.

                  </p>

                  <div className="bg-white/5 rounded-xl p-4">

                    <p className="text-sm font-medium text-emerald-200 mb-2">Security Guidelines:</p>

                    <ul className="text-sm space-y-2">

                      <li className="flex items-center gap-2">

                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>

                        Never share your login credentials

                      </li>

                      <li className="flex items-center gap-2">

                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>

                        Log out after each session

                      </li>

                      <li className="flex items-center gap-2">

                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>

                        Report suspicious activity immediately

                      </li>

                    </ul>

                  </div>

                  

                  <p className="text-sm text-emerald-200/80 pt-4 border-t border-emerald-500/20">

                    For urgent technical support, please include your username and 

                    a detailed description of the issue in your communication.

                  </p>

                </div>

              </div>

            </div>

          </div>

        </section>

      </main>



      {/* Footer */}

      <footer className="bg-gray-900 text-gray-400 py-8">

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="flex flex-col md:flex-row justify-between items-center">

            <div className="flex items-center space-x-3 mb-4 md:mb-0">

              <div className="bg-emerald-600 w-8 h-8 rounded-lg flex items-center justify-center">

                <BarChart3 className="w-5 h-5 text-white" />

              </div>

              <div>

                <div className="text-white font-bold">AgriPerformance</div>

                <div className="text-xs">Ministry of Agriculture</div>

              </div>

            </div>

            

            <div className="text-sm">

              © {new Date().getFullYear()} Planning & Performance Platform. All rights reserved.

            </div>

            

            <div className="flex space-x-6 mt-4 md:mt-0">

              <button onClick={() => navigate('/privacy-policy')} className="text-sm hover:text-white transition-colors">Privacy Policy</button>

              <button className="text-sm hover:text-white transition-colors">Terms of Use</button>

              <button className="text-sm hover:text-white transition-colors">Accessibility</button>

            </div>

          </div>

        </div>

      </footer>



      {/* Add custom styles for grid pattern */}

      <style>{`

        .bg-grid-pattern {

          background-image: 

            linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px),

            linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px);

          background-size: 20px 20px;

        }

      `}</style>

    </div>

  );

}