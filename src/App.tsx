import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, Star, Shield, Sparkles, Droplets, ArrowRight, Menu, X, MapPin, Phone, Mail, Instagram, Facebook } from 'lucide-react';

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed w-full z-50 transition-all duration-300 ${isScrolled ? 'bg-black/80 backdrop-blur-md py-4 border-b border-white/5' : 'bg-transparent py-6'}`}>
      <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
        <div className="text-white font-bold text-2xl tracking-tighter flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-emerald-400" />
          <span>LUMEN<span className="text-emerald-400">.</span></span>
        </div>
        
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-300">
          <a href="#diensten" className="hover:text-white transition-colors">Diensten</a>
          <a href="#galerij" className="hover:text-white transition-colors">Galerij</a>
          <a href="#werkwijze" className="hover:text-white transition-colors">Werkwijze</a>
          <a href="#contact" className="hover:text-white transition-colors">Contact</a>
        </div>

        <div className="hidden md:block">
          <button className="bg-white text-black px-6 py-2.5 rounded-full font-semibold text-sm hover:bg-gray-200 transition-colors">
            Boek Nu
          </button>
        </div>

        <button className="md:hidden text-white" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-full left-0 w-full bg-black/95 backdrop-blur-lg border-t border-white/10 py-6 px-6 flex flex-col gap-4 md:hidden"
          >
            <a href="#diensten" className="text-white text-lg font-medium" onClick={() => setMobileMenuOpen(false)}>Diensten</a>
            <a href="#galerij" className="text-white text-lg font-medium" onClick={() => setMobileMenuOpen(false)}>Galerij</a>
            <a href="#werkwijze" className="text-white text-lg font-medium" onClick={() => setMobileMenuOpen(false)}>Werkwijze</a>
            <a href="#contact" className="text-white text-lg font-medium" onClick={() => setMobileMenuOpen(false)}>Contact</a>
            <button className="bg-white text-black px-6 py-3 rounded-full font-semibold text-center mt-4">
              Boek Nu
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

const Hero = () => {
  return (
    <section className="relative h-screen w-full overflow-hidden flex items-center justify-center bg-black">
      <div className="absolute inset-0 z-0 overflow-hidden">
        <motion.img 
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          src="https://images.unsplash.com/photo-1614200187524-dc4b892acf16?q=80&w=2000&auto=format&fit=crop" 
          alt="Supercar detailing" 
          className="w-full h-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-[#0a0a0a]"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 w-full flex flex-col items-center text-center mt-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-sm font-medium mb-8"
        >
          <Star className="w-4 h-4 text-emerald-400 fill-emerald-400" />
          <span>#1 Premium Detailing in Nederland</span>
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
          className="text-5xl md:text-7xl lg:text-8xl font-bold text-white tracking-tighter leading-[1.05] max-w-5xl"
        >
          Spiegelglans die <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">indruk maakt.</span>
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="mt-6 text-lg md:text-xl text-gray-300 max-w-2xl font-light"
        >
          Wij transformeren uw voertuig naar showroomstaat met exclusieve keramische coatings, lakcorrectie en high-end detailing.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
          className="mt-10 flex flex-col sm:flex-row gap-4"
        >
          <button className="bg-white text-black px-8 py-4 rounded-full font-bold text-lg hover:scale-105 transition-transform flex items-center justify-center gap-2">
            Boek een afspraak <ArrowRight className="w-5 h-5" />
          </button>
          <button className="bg-white/10 backdrop-blur-md border border-white/20 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-white/20 transition-colors flex items-center justify-center">
            Bekijk portfolio
          </button>
        </motion.div>
      </div>
      
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 1 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <span className="text-white/50 text-xs uppercase tracking-widest">Scroll</span>
        <div className="w-[1px] h-12 bg-gradient-to-b from-white/50 to-transparent"></div>
      </motion.div>
    </section>
  );
};

const Process = () => {
  const steps = [
    { num: "01", title: "Boek Online", desc: "Kies uw dienst en plan eenvoudig een afspraak in via ons portaal." },
    { num: "02", title: "Inspectie", desc: "We inspecteren de staat van uw voertuig en bespreken uw wensen." },
    { num: "03", title: "Transformatie", desc: "Onze experts gaan aan de slag met de hoogste kwaliteit producten." },
    { num: "04", title: "Oplevering", desc: "U ontvangt uw voertuig terug in absolute perfecte showroomstaat." }
  ];

  return (
    <section id="werkwijze" className="py-24 bg-[#0a0a0a] border-y border-white/5">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8">
          {steps.map((step, idx) => (
            <motion.div 
              key={idx} 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="relative"
            >
              <div className="text-emerald-400/20 font-bold text-6xl mb-4 tracking-tighter">{step.num}</div>
              <h4 className="text-white text-xl font-bold mb-2">{step.title}</h4>
              <p className="text-gray-400 text-sm leading-relaxed">{step.desc}</p>
              {idx < steps.length - 1 && (
                <div className="hidden md:block absolute top-8 right-0 w-full h-[1px] bg-gradient-to-r from-white/10 to-transparent translate-x-1/2"></div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const Services = () => {
  const services = [
    {
      icon: <Sparkles className="w-8 h-8 text-emerald-400" />,
      title: "Lakcorrectie",
      desc: "Verwijder krassen, swirls en imperfecties voor een spiegelgladde, vlekkeloze afwerking van uw lak.",
      price: "Vanaf €299"
    },
    {
      icon: <Shield className="w-8 h-8 text-emerald-400" />,
      title: "Keramische Coating",
      desc: "Jarenlange bescherming tegen weersinvloeden, vuil en UV-straling met een extreme waterafstotende werking.",
      price: "Vanaf €499"
    },
    {
      icon: <Droplets className="w-8 h-8 text-emerald-400" />,
      title: "Interieur Detailing",
      desc: "Dieptereiniging van bekleding, leerbehandeling en geurverwijdering voor een fris en luxueus interieur.",
      price: "Vanaf €149"
    }
  ];

  return (
    <section id="diensten" className="py-32 bg-[#0a0a0a] relative">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
          <div className="max-w-2xl">
            <h2 className="text-emerald-400 font-semibold tracking-wider uppercase text-sm mb-3">Onze Expertise</h2>
            <h3 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white tracking-tight">Premium diensten voor de <span className="italic font-light">perfectionist</span>.</h3>
          </div>
          <button className="text-white border-b border-white/30 pb-1 hover:border-white transition-colors flex items-center gap-2 whitespace-nowrap">
            Alle diensten bekijken <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {services.map((service, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="bg-[#141414] border border-white/5 rounded-3xl p-8 hover:bg-[#1a1a1a] transition-colors group flex flex-col h-full"
            >
              <div className="bg-black/50 w-16 h-16 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                {service.icon}
              </div>
              <h4 className="text-2xl font-bold text-white mb-4">{service.title}</h4>
              <p className="text-gray-400 leading-relaxed mb-8 flex-grow">{service.desc}</p>
              <div className="flex items-center justify-between mt-auto pt-6 border-t border-white/5">
                <span className="text-white font-medium">{service.price}</span>
                <button className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white group-hover:bg-emerald-400 group-hover:text-black transition-colors">
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const Gallery = () => {
  return (
    <section id="galerij" className="py-32 bg-black relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-20">
          <h2 className="text-emerald-400 font-semibold tracking-wider uppercase text-sm mb-3">Voor & Na</h2>
          <h3 className="text-4xl md:text-6xl font-bold text-white tracking-tight">Transformaties die <br/>verbazen.</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="group relative rounded-3xl overflow-hidden aspect-[4/3] bg-[#141414]"
          >
            <img src="https://images.unsplash.com/photo-1601362840469-51e4d8d58785?q=80&w=2070&auto=format&fit=crop" alt="Car before and after" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-8">
              <div>
                <h4 className="text-white text-2xl font-bold mb-1">Porsche 911 GT3</h4>
                <p className="text-emerald-400 font-medium text-sm">Stage 2 Lakcorrectie & Keramische Coating</p>
              </div>
            </div>
            <div className="absolute top-6 left-6 bg-black/60 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-medium text-white border border-white/10">
              Na Behandeling
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="group relative rounded-3xl overflow-hidden aspect-[4/3] bg-[#141414]"
          >
            <img src="https://images.unsplash.com/photo-1552519507-da3b142c6e3d?q=80&w=2070&auto=format&fit=crop" alt="Car before and after" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-8">
              <div>
                <h4 className="text-white text-2xl font-bold mb-1">Audi RS6</h4>
                <p className="text-emerald-400 font-medium text-sm">Volledige PPF Installatie</p>
              </div>
            </div>
            <div className="absolute top-6 left-6 bg-black/60 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-medium text-white border border-white/10">
              Na Behandeling
            </div>
          </motion.div>
        </div>

        <div className="mt-16 text-center">
          <button className="bg-white text-black px-8 py-4 rounded-full font-bold hover:scale-105 transition-transform inline-flex items-center gap-2">
            Bekijk volledige galerij <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </section>
  );
};

const CTA = () => {
  return (
    <section className="py-32 bg-black relative overflow-hidden">
      <div className="absolute inset-0">
        <img src="https://images.unsplash.com/photo-1605515298946-d062f2e9da53?q=80&w=2000&auto=format&fit=crop" alt="Detailing background" className="w-full h-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-black/80 to-transparent"></div>
      </div>
      
      <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
        <h2 className="text-5xl md:text-7xl font-bold text-white tracking-tight mb-6">
          Klaar voor de <span className="italic font-light text-emerald-400">perfecte</span> glans?
        </h2>
        <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto font-light">
          Plan vandaag nog uw afspraak en geef uw auto de behandeling die hij verdient. Binnen 60 seconden geregeld.
        </p>
        <button className="bg-emerald-500 text-black px-10 py-5 rounded-full font-bold text-lg hover:bg-emerald-400 hover:scale-105 transition-all shadow-[0_0_40px_rgba(16,185,129,0.3)]">
          Maak direct een afspraak
        </button>
      </div>
    </section>
  );
};

const Footer = () => {
  return (
    <footer id="contact" className="bg-[#050505] pt-20 pb-10 border-t border-white/10">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="col-span-1 md:col-span-2">
            <div className="text-white font-bold text-2xl tracking-tighter flex items-center gap-2 mb-6">
              <Sparkles className="w-6 h-6 text-emerald-400" />
              <span>LUMEN<span className="text-emerald-400">.</span></span>
            </div>
            <p className="text-gray-400 max-w-sm mb-8 leading-relaxed">
              Premium auto detailing studio in Nederland. Wij streven naar perfectie in elk detail, van lakcorrectie tot keramische coatings.
            </p>
            <div className="flex gap-4">
              <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white hover:bg-emerald-500 hover:text-black transition-colors">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white hover:bg-emerald-500 hover:text-black transition-colors">
                <Facebook className="w-5 h-5" />
              </a>
            </div>
          </div>
          
          <div>
            <h4 className="text-white font-semibold mb-6">Contact</h4>
            <ul className="space-y-4 text-gray-400">
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>Automotive Boulevard 12<br/>1000 AA Amsterdam</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>+31 (0)20 123 4567</span>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>info@lumendetailing.nl</span>
              </li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-white font-semibold mb-6">Openingstijden</h4>
            <ul className="space-y-3 text-gray-400">
              <li className="flex justify-between"><span>Ma - Vr:</span> <span className="text-white">08:30 - 18:00</span></li>
              <li className="flex justify-between"><span>Zaterdag:</span> <span className="text-white">09:00 - 15:00</span></li>
              <li className="flex justify-between text-emerald-400"><span>Zondag:</span> <span>Gesloten</span></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} Lumen Detailing. Alle rechten voorbehouden.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white transition-colors">Privacybeleid</a>
            <a href="#" className="hover:text-white transition-colors">Algemene Voorwaarden</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default function App() {
  return (
    <div className="bg-black min-h-screen text-white font-sans selection:bg-emerald-500/30">
      <Navbar />
      <Hero />
      <Process />
      <Services />
      <Gallery />
      <CTA />
      <Footer />
    </div>
  );
}
