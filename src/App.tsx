/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Users, 
  Target, 
  Calendar, 
  CheckCircle, 
  DollarSign, 
  PieChart, 
  ArrowRight,
  Calculator,
  Info,
  Lock,
  LogIn,
  Eye,
  EyeOff,
  LogOut,
  ShieldCheck,
  UserCheck,
  UserX,
  CreditCard,
  Search,
  AlertCircle,
  RefreshCw,
  MessageSquare,
  FileText,
  Settings,
  LayoutDashboard,
  CheckSquare,
  Send,
  Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";

// Firebase Imports
import { auth, db, firebaseConfig } from './firebase';
import { initializeApp, deleteApp } from 'firebase/app';
import { 
  getAuth,
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  onSnapshot, 
  query, 
  where,
  Timestamp,
  getDocFromServer,
  addDoc,
  deleteDoc,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';

// Types
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'client';
  status: 'active' | 'blocked' | 'pending';
  lastPaymentDate?: any;
  createdAt: any;
}

interface WhatsAppScript {
  id?: string;
  uid: string;
  type: 'qualificacao' | 'direto';
  clinicName?: string;
  professionalName?: string;
  methodName?: string;
  procedureSteps?: string;
  qualificationData?: string;
  socialProof?: string;
  generatedScript: string;
  createdAt: any;
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, errorInfo: string | null }> {
  state: { hasError: boolean, errorInfo: string | null } = { hasError: false, errorInfo: null };
  props: { children: React.ReactNode };

  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.props = props;
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, errorInfo: error.message };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let displayMessage = "Ocorreu um erro inesperado. Por favor, recarregue a página.";
      try {
        const parsed = JSON.parse(this.state.errorInfo || "");
        if (parsed.error && parsed.error.includes("insufficient permissions")) {
          displayMessage = "Você não tem permissão para realizar esta operação. Se o problema persistir, entre em contato com o suporte.";
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-10 max-w-md text-center shadow-xl border border-gray-100">
            <div className="bg-red-50 text-red-500 w-16 h-16 flex items-center justify-center rounded-2xl mx-auto mb-6">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Ops! Algo deu errado</h1>
            <p className="text-gray-500 mb-8">{displayMessage}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="w-full bg-black text-white rounded-2xl py-4 font-bold text-sm tracking-widest uppercase hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Recarregar Página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'app' | 'admin' | 'history'>('app');
  const [appSubTab, setAppSubTab] = useState<'simulator' | 'pricing' | 'copy'>('simulator');

  // Pricing Confirmation State
  const [procedureCost, setProcedureCost] = useState<number>(500);
  const [marketingCost, setMarketingCost] = useState<number>(200);
  const [fixedCosts, setFixedCosts] = useState<number>(300);
  const [desiredProfitMargin, setDesiredProfitMargin] = useState<number>(30);
  const [suggestedPrice, setSuggestedPrice] = useState<number>(0);

  // Copy Generator State
  const [whatsappSubtype, setWhatsappSubtype] = useState<'qualificacao' | 'direto'>('qualificacao');
  
  // WhatsApp Specific Inputs
  const [desiresFears, setDesiresFears] = useState('');
  const [methodName, setMethodName] = useState('');
  const [curiosity, setCuriosity] = useState('');
  const [objection, setObjection] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [professionalName, setProfessionalName] = useState('');
  const [livesHelped, setLivesHelped] = useState('');
  const [bonusGift, setBonusGift] = useState('');
  const [procedureSteps, setProcedureSteps] = useState('');
  const [qualificationData, setQualificationData] = useState('');

  const [generatedCopy, setGeneratedCopy] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [whatsappScripts, setWhatsappScripts] = useState<WhatsAppScript[]>([]);
  const [whatsappTab, setWhatsappTab] = useState<'generator' | 'history'>('generator');
  const [scriptSearchTerm, setScriptSearchTerm] = useState('');

  // Add User State
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [addUserSuccess, setAddUserSuccess] = useState(false);

  // Auth Form State
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // Inputs
  const [investment, setInvestment] = useState<number>(5000);
  const [costPerLead, setCostPerLead] = useState<number>(10);
  const [appointmentRate, setAppointmentRate] = useState<number>(30);
  const [attendanceRate, setAttendanceRate] = useState<number>(50);
  const [conversionRate, setConversionRate] = useState<number>(20);
  const [averageTicket, setAverageTicket] = useState<number>(1500);

  // Calculated values
  const [leads, setLeads] = useState<number>(0);
  const [scheduledClients, setScheduledClients] = useState<number>(0);
  const [attendedClients, setAttendedClients] = useState<number>(0);
  const [salesCount, setSalesCount] = useState<number>(0);
  const [revenue, setRevenue] = useState<number>(0);
  const [profit, setProfit] = useState<number>(0);
  const [roi, setRoi] = useState<number>(0);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await syncUserProfile(firebaseUser);
      } else {
        setProfile(null);
      }
      setIsAuthReady(true);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Admin: Listen to all users
  useEffect(() => {
    if (profile?.role === 'admin') {
      const path = 'users';
      const unsubscribe = onSnapshot(collection(db, path), (snapshot) => {
        const users = snapshot.docs.map(doc => doc.data() as UserProfile);
        setAllUsers(users);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      });
      return () => unsubscribe();
    }
  }, [profile]);

  // Calculations
  useEffect(() => {
    const calculatedLeads = investment / costPerLead;
    const calculatedScheduled = calculatedLeads * (appointmentRate / 100);
    const calculatedAttended = calculatedScheduled * (attendanceRate / 100);
    const calculatedSales = calculatedAttended * (conversionRate / 100);
    const calculatedRevenue = calculatedSales * averageTicket;
    const calculatedProfit = calculatedRevenue - investment;
    const calculatedRoi = investment > 0 ? (calculatedProfit / investment) * 100 : 0;

    setLeads(calculatedLeads);
    setScheduledClients(calculatedScheduled);
    setAttendedClients(calculatedAttended);
    setSalesCount(calculatedSales);
    setRevenue(calculatedRevenue);
    setProfit(calculatedProfit);
    setRoi(calculatedRoi);
  }, [investment, costPerLead, appointmentRate, attendanceRate, conversionRate, averageTicket]);

  // Pricing Calculation
  useEffect(() => {
    const totalCosts = procedureCost + marketingCost + fixedCosts;
    const margin = desiredProfitMargin / 100;
    if (margin < 1) {
      setSuggestedPrice(totalCosts / (1 - margin));
    }
  }, [procedureCost, marketingCost, fixedCosts, desiredProfitMargin]);

  // WhatsApp Scripts History Listener
  useEffect(() => {
    if (user && profile?.status === 'active') {
      const path = 'whatsapp_scripts';
      const q = query(
        collection(db, path),
        where('uid', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const scripts = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as WhatsAppScript));
        setWhatsappScripts(scripts);
      }, (error) => {
        console.error("Error fetching scripts history:", error);
      });
      
      return () => unsubscribe();
    }
  }, [user, profile]);

  const deleteScript = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este script do histórico?")) return;
    const path = `whatsapp_scripts/${id}`;
    try {
      await deleteDoc(doc(db, 'whatsapp_scripts', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const generateCopy = async () => {
    if (whatsappSubtype === 'qualificacao') {
      if (!desiresFears || !methodName || !curiosity || !objection || !clinicName || !professionalName || !livesHelped || !bonusGift) return;
    } else {
      if (!methodName || !procedureSteps || !qualificationData || !clinicName || !professionalName) return;
    }
    
    setIsGenerating(true);
    setGeneratedCopy('');
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      let prompt = '';
      
      if (whatsappSubtype === 'qualificacao') {
          prompt = `Você é um especialista em marketing para médicos e clínicas de estética, mestre em scripts de conversão no WhatsApp.
          Gere um script de WhatsApp estruturado em 5 PASSOS seguindo exatamente esta sequência e regras:
          
          DADOS PARA O SCRIPT:
          - Nome da Clínica: ${clinicName}
          - Nome do Profissional: ${professionalName}
          - Vidas Ajudadas (Número): ${livesHelped}
          - Desejos/Medos/Frustrações/Transformação: ${desiresFears}
          - Nome do Método: ${methodName}
          - Curiosidade sobre o procedimento: ${curiosity}
          - Quebra de Objeção: ${objection}
          - Presente/Bônus para agendamento imediato: ${bonusGift}
          
          ESTRUTURA OBRIGATÓRIA E REGRAS POR PASSO:
          
          1. Abordagem Inicial (Dividida em 3 Mensagens curtas):
             - Mensagem 1: Saudação calorosa + Apresentação (ex: Olá! Tudo bem? Aqui é ${professionalName} da ${clinicName}).
             - Mensagem 2: Prova social + Autoridade (ex: Até agora nós já ajudamos mais de ${livesHelped} vidas a ${desiresFears} através do nosso método exclusivo *${methodName}*).
             - Mensagem 3: Curiosidade + Objeção + Filtro de Qualificação (ex: O diferencial é que usamos ${curiosity}, ${objection}. Como temos um volume muito alto de procura, só damos continuidade a quem realmente podemos ajudar. Para isso, me informe seu nome, peso e altura?).
             - REGRA: Termine obrigatoriamente pedindo os dados de qualificação.
          
          2. Perguntas de Qualificação:
             - Analise os dados recebidos.
             - REGRA: Faça uma nova pergunta de qualificação profunda para entender o caso da paciente (ex: há quanto tempo isso te incomoda? ou o que você já tentou fazer para resolver?).
          
          3. Conversa Única + 4. Prova Social (ESTES DOIS PASSOS DEVEM SAIR JUNTOS):
             - Explique como o método funciona de forma única.
             - Conecte imediatamente com a Prova Social.
             - REGRA: NÃO faça pergunta de condução ao final da Conversa Única.
             - REGRA: No final da Prova Social, o script deve simular o envio de resultados (ex: [ENVIA FOTOS/VÍDEOS DE RESULTADOS]).
             - REGRA: A pergunta de condução final DEVE ser exatamente: "O resultado desses vídeos e fotos que te enviei faz sentido para você? É exatamente isso que você busca?".
          
          5. Fechamento (Conversão Final):
             - Explique que o primeiro passo é a avaliação (anamnese, análise técnica).
             - Use gatilhos de escassez e urgência (agenda disputada, muitos anúncios).
             - Apresente 2 ou 3 dias com horários específicos (ex: Segunda 14h ou 16h).
             - Mencione que o agendamento deve ser feito em no máximo 40 horas.
             - Ofereça o presente/bônus (${bonusGift}) para agendamento IMEDIATO.
             - REGRA: Termine com a pergunta: "Qual desses horários fica melhor pra você?" ou "Algum desses horários fez sentido para você?".
          
          REGRAS GERAIS:
          - Use um tom profissional, empático e persuasivo.
          - Formate a resposta com títulos claros para cada passo.`;
        } else {
          prompt = `Você é um especialista em marketing para médicos e clínicas de estética, mestre em scripts de conversão no WhatsApp.
          Gere um script de WhatsApp para ANÚNCIOS DIRETO (focado em quem já clicou querendo a solução) estruturado em 2 PASSOS, seguindo o estilo de mensagens curtas e diretas:
          
          DADOS PARA O SCRIPT:
          - Nome da Clínica: ${clinicName}
          - Nome do Profissional: ${professionalName}
          - Nome do Método: ${methodName}
          - O que fazemos no procedimento (Lista): ${procedureSteps}
          - Dado de Qualificação Solicitado: ${qualificationData}
          
          ESTRUTURA OBRIGATÓRIA E REGRAS POR PASSO:
          
          1. Abordagem Inicial (Dividida em 3 Mensagens curtas):
             - Mensagem 1: "Olá, tudo bem? Aqui é ${professionalName} da ${clinicName} e vou te falar um resumo sobre nosso procedimento!"
             - Mensagem 2: "Devido a PROMOÇÃO (ou alta procura) estamos com uma grande demanda e não conseguimos responder todas imediatamente. Abaixo segue as informações do nosso protocolo 👇"
             - Mensagem 3: "*${methodName}*" + "⏳Temos apenas poucas vagas com esse valor. Durante o procedimento fazemos:" + [TRANSFORME ${procedureSteps} EM UMA LISTA COM CHECKMARKS ✅] + "Para reservar sua vaga me informe seu Nome e o *${qualificationData}* que vamos enviar os horários disponíveis."
          
          2. Fechamento (Conversão Final):
             - Saudação rápida (ex: "Ei, tudo bem?").
             - "Tenho os seguintes horários disponíveis:" + Lista de 3 opções de dias/horários.
             - REGRA: Termine com a pergunta: "Qual desses horários fica melhor pra você?".
          
          REGRAS GERAIS:
          - Use mensagens curtas e diretas, exatamente como no exemplo do usuário.
          - Use emojis de forma estratégica (checkmarks, ampulheta, etc).
          - Formate a resposta com títulos claros para cada passo.`;
        }

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      const generatedText = response.text || "Não foi possível gerar o script. Tente novamente.";
      setGeneratedCopy(generatedText);

      // Save to history
      if (user && profile?.status === 'active') {
        const scriptData: WhatsAppScript = {
          uid: user.uid,
          type: whatsappSubtype,
          clinicName,
          professionalName,
          methodName,
          procedureSteps: whatsappSubtype === 'direto' ? procedureSteps : undefined,
          qualificationData: whatsappSubtype === 'direto' ? qualificationData : undefined,
          socialProof: whatsappSubtype === 'qualificacao' ? livesHelped : undefined,
          generatedScript: generatedText,
          createdAt: Timestamp.now()
        };
        
        const path = 'whatsapp_scripts';
        try {
          await addDoc(collection(db, path), scriptData);
        } catch (err) {
          console.error("Error saving script to history:", err);
        }
      }
    } catch (error) {
      console.error("Error generating copy:", error);
      setGeneratedCopy("Erro ao gerar conteúdo. Verifique sua conexão.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail) {
      alert('Por favor, informe o e-mail.');
      return;
    }
    
    setIsAddingUser(true);
    setAddUserSuccess(false);
    setAuthError(null);
    
    const password = Math.random().toString(36).slice(-8); // Random 8-char password
    setGeneratedPassword(password);

    let secondaryApp;
    try {
      // Secondary app trick to create user without logging out admin
      secondaryApp = initializeApp(firebaseConfig, 'Secondary');
      const secondaryAuth = getAuth(secondaryApp);
      
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newUserEmail, password);
      const newUid = userCredential.user.uid;
      
      // Create profile in Firestore
      await setDoc(doc(db, 'users', newUid), {
        uid: newUid,
        email: newUserEmail,
        displayName: newUserEmail.split('@')[0],
        role: 'client',
        status: 'active',
        createdAt: serverTimestamp()
      });

      setAddUserSuccess(true);
      setNewUserEmail('');
    } catch (error: any) {
      console.error("Error adding user:", error);
      let message = error.message;
      if (error.code === 'auth/email-already-in-use') message = 'Este e-mail já está em uso.';
      if (error.code === 'auth/operation-not-allowed') message = 'O método de login por e-mail/senha não está ativado no Firebase.';
      setAuthError(message);
      alert(`Erro ao adicionar usuário: ${message}`);
    } finally {
      if (secondaryApp) {
        try {
          await deleteApp(secondaryApp);
        } catch (err) {
          console.error('Error deleting secondary app:', err);
        }
      }
      setIsAddingUser(false);
    }
  };

  const syncUserProfile = async (firebaseUser: FirebaseUser) => {
    const path = `users/${firebaseUser.uid}`;
    const userRef = doc(db, 'users', firebaseUser.uid);
    try {
      const userSnap = await getDoc(userRef);
      const isDefaultAdmin = firebaseUser.email === 'trebor262@gmail.com';

      if (!userSnap.exists()) {
        const newProfile: UserProfile = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || 'Usuário',
          role: isDefaultAdmin ? 'admin' : 'client',
          status: isDefaultAdmin ? 'active' : 'pending',
          createdAt: Timestamp.now(),
        };
        try {
          await setDoc(userRef, newProfile);
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, path);
        }
        setProfile(newProfile);
      } else {
        const existingData = userSnap.data() as UserProfile;
        // Self-fix for default admin if they are stuck in wrong role/status
        if (isDefaultAdmin && (existingData.role !== 'admin' || existingData.status !== 'active')) {
          try {
            await updateDoc(userRef, { role: 'admin', status: 'active' });
            setProfile({ ...existingData, role: 'admin', status: 'active' });
          } catch (err) {
            console.error("Failed to self-fix admin profile:", err);
            setProfile(existingData);
          }
        } else {
          setProfile(existingData);
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('{')) {
        throw error; // Re-throw our custom error
      }
      handleFirestoreError(error, OperationType.GET, path);
    }
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    setAuthError(null);
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Login error:", error);
      setAuthError("Erro ao entrar com Google. Tente novamente.");
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    setResetSent(false);

    try {
      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else if (authMode === 'register') {
        await createUserWithEmailAndPassword(auth, email, password);
      } else if (authMode === 'forgot') {
        await sendPasswordResetEmail(auth, email);
        setResetSent(true);
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      let message = "Ocorreu um erro. Verifique seus dados.";
      if (error.code === 'auth/user-not-found') message = "Usuário não encontrado.";
      if (error.code === 'auth/wrong-password') message = "Senha incorreta.";
      if (error.code === 'auth/email-already-in-use') message = "Este e-mail já está em uso.";
      if (error.code === 'auth/weak-password') message = "A senha deve ter pelo menos 6 caracteres.";
      if (error.code === 'auth/invalid-email') message = "E-mail inválido.";
      setAuthError(message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => signOut(auth);

  const toggleUserStatus = async (userId: string, currentStatus: string) => {
    const path = `users/${userId}`;
    const newStatus = currentStatus === 'active' ? 'blocked' : 'active';
    try {
      await updateDoc(doc(db, 'users', userId), { status: newStatus });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      maximumFractionDigits: 1,
    }).format(value);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-6 font-sans">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <div className="bg-white rounded-[2.5rem] p-10 shadow-2xl overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500" />
            
            <div className="flex flex-col items-center mb-8">
              <div className="bg-black text-white w-16 h-16 flex items-center justify-center rounded-2xl font-bold text-3xl tracking-tighter mb-6 shadow-xl">
                PVA
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                {authMode === 'login' ? 'Bem-vindo de volta' : authMode === 'register' ? 'Criar Conta' : 'Recuperar Senha'}
              </h1>
              <p className="text-gray-500 text-sm mt-2 text-center">
                {authMode === 'login' ? 'Acesse sua conta para continuar' : authMode === 'register' ? 'Cadastre-se para começar a simular' : 'Enviaremos um link para seu e-mail'}
              </p>
            </div>

            {authError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {authError}
              </div>
            )}

            {resetSent && (
              <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 text-emerald-600 text-xs rounded-xl flex items-center gap-2">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                E-mail de recuperação enviado com sucesso!
              </div>
            )}

            <form onSubmit={handleEmailAuth} className="space-y-4 mb-6">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">E-mail</label>
                <div className="relative">
                  <LogIn className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 transition-all"
                  />
                </div>
              </div>

              {authMode !== 'forgot' && (
                <div className="space-y-1">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Senha</label>
                    {authMode === 'login' && (
                      <button 
                        type="button"
                        onClick={() => setAuthMode('forgot')}
                        className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 hover:text-indigo-600"
                      >
                        Esqueceu?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                    <input 
                      type="password" 
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 transition-all"
                    />
                  </div>
                </div>
              )}

              <button 
                type="submit"
                disabled={authLoading}
                className="w-full bg-black text-white rounded-2xl py-4 font-bold text-sm tracking-widest uppercase hover:bg-gray-800 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {authLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  authMode === 'login' ? 'Entrar' : authMode === 'register' ? 'Cadastrar' : 'Enviar Link'
                )}
              </button>
            </form>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-100"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
                <span className="bg-white px-4 text-gray-400">Ou continue com</span>
              </div>
            </div>

            <button 
              onClick={handleGoogleLogin}
              className="w-full bg-white border-2 border-gray-100 text-gray-700 rounded-2xl py-4 font-bold text-sm tracking-widest uppercase hover:bg-gray-50 transition-all shadow-sm flex items-center justify-center gap-3 group"
            >
              <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
              Google
            </button>

            <div className="mt-8 text-center space-y-4">
              <p className="text-xs text-gray-500">
                {authMode === 'login' ? (
                  <>Não tem uma conta? <button onClick={() => setAuthMode('register')} className="font-bold text-black border-b border-black/20">Cadastre-se</button></>
                ) : (
                  <>Já tem uma conta? <button onClick={() => setAuthMode('login')} className="font-bold text-black border-b border-black/20">Entre aqui</button></>
                )}
              </p>
              
              <div className="pt-4 border-t border-gray-50">
                <p className="text-[10px] text-gray-400 mb-1">Dificuldades no acesso? Entre em contato com o suporte.</p>
                <p className="text-[10px] text-gray-400 mb-4 italic">Se você é o administrador, certifique-se de usar o e-mail cadastrado.</p>
                <span className="text-[10px] text-gray-300 uppercase tracking-widest">PVA Sales Intelligence © 2026</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (profile?.status === 'blocked') {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-6">
        <div className="bg-white rounded-[2.5rem] p-10 max-w-md text-center">
          <div className="bg-red-50 text-red-500 w-16 h-16 flex items-center justify-center rounded-2xl mx-auto mb-6">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Acesso Bloqueado</h1>
          <p className="text-gray-500 mb-8">Sua conta está suspensa por falta de pagamento ou violação dos termos. Entre em contato com o suporte.</p>
          <button onClick={handleLogout} className="text-sm font-bold uppercase text-gray-400 hover:text-black">Sair da Conta</button>
        </div>
      </div>
    );
  }

  if (profile?.status === 'pending' && profile?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-6">
        <div className="bg-white rounded-[2.5rem] p-10 max-w-md text-center">
          <div className="bg-amber-50 text-amber-500 w-16 h-16 flex items-center justify-center rounded-2xl mx-auto mb-6">
            <CreditCard className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Aguardando Ativação</h1>
          <p className="text-gray-500 mb-8">Seu cadastro foi recebido! O administrador irá ativar sua conta assim que o pagamento for confirmado.</p>
          <button onClick={handleLogout} className="text-sm font-bold uppercase text-gray-400 hover:text-black">Sair da Conta</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex flex-col sm:flex-row justify-between items-center sticky top-0 z-20 gap-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="bg-black text-white w-10 h-10 flex items-center justify-center rounded-lg font-bold text-xl tracking-tighter">
              PVA
            </div>
            <h1 className="text-lg font-semibold tracking-tight">Sales Intelligence</h1>
          </div>
          
          <nav className="flex bg-gray-100 p-1 rounded-xl">
            <button 
              onClick={() => setActiveTab('app')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'app' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Início
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'history' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Históricos de Automação
            </button>
            {profile?.role === 'admin' && (
              <button 
                onClick={() => setActiveTab('admin')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'admin' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Gestão
              </button>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-gray-900">{profile?.displayName}</div>
              <div className="text-[10px] text-gray-400 uppercase tracking-widest">{profile?.email}</div>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-red-500"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 lg:p-10">
        {activeTab === 'admin' && profile?.role === 'admin' ? (
          <div className="space-y-8">
            {/* Admin Dashboard */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Gestão de Usuários</h2>
                <p className="text-sm text-gray-500">Controle de acessos e assinaturas do micro-SaaS</p>
              </div>
              <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
                <button 
                  onClick={() => setIsAddUserModalOpen(true)}
                  className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-800 transition-all w-full md:w-auto"
                >
                  <Users className="w-4 h-4" />
                  Adicionar Usuário
                </button>
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Buscar por e-mail..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-black/5"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-gray-400">Usuário</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-gray-400">Status</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-gray-400">Função</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-gray-400">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {allUsers
                    .filter(u => u.email.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map(u => (
                    <tr key={u.uid} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-sm text-gray-900">{u.displayName}</div>
                        <div className="text-xs text-gray-400">{u.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                          u.status === 'active' ? 'bg-emerald-100 text-emerald-600' : 
                          u.status === 'blocked' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                        }`}>
                          {u.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs text-gray-500 font-mono">{u.role}</span>
                      </td>
                      <td className="px-6 py-4">
                        {u.role !== 'admin' && (
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => toggleUserStatus(u.uid, u.status)}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                                u.status === 'active' 
                                  ? 'bg-red-50 text-red-500 hover:bg-red-100' 
                                  : 'bg-emerald-50 text-emerald-500 hover:bg-emerald-100'
                              }`}
                            >
                              {u.status === 'active' ? (
                                <>
                                  <UserX className="w-3.5 h-3.5" />
                                  Bloquear
                                </>
                              ) : (
                                <>
                                  <UserCheck className="w-3.5 h-3.5" />
                                  Ativar
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : activeTab === 'history' ? (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Históricos de Automação</h2>
                <p className="text-sm text-gray-500">Acesse todos os scripts gerados pela inteligência artificial</p>
              </div>
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Buscar por procedimento..."
                  value={scriptSearchTerm}
                  onChange={(e) => setScriptSearchTerm(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-black/5"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {whatsappScripts
                .filter(s => 
                  s.methodName?.toLowerCase().includes(scriptSearchTerm.toLowerCase()) || 
                  s.clinicName?.toLowerCase().includes(scriptSearchTerm.toLowerCase())
                )
                .map((script) => (
                  <motion.div 
                    layout
                    key={script.id} 
                    className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-100/50 flex flex-col h-full group hover:border-black/10 transition-all"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${script.type === 'qualificacao' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {script.type === 'qualificacao' ? 'Qualificação' : 'Direto'}
                      </span>
                      <button 
                        onClick={() => script.id && deleteScript(script.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors p-1"
                      >
                        <UserX className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <h3 className="text-lg font-bold text-gray-900 mb-1">{script.methodName}</h3>
                    <p className="text-xs text-gray-400 mb-4">{script.clinicName} • {script.createdAt?.toDate().toLocaleDateString()}</p>
                    
                    <div className="flex-1 bg-gray-50 rounded-2xl p-4 mb-4 overflow-hidden relative">
                      <p className="text-[10px] text-gray-600 line-clamp-6 whitespace-pre-wrap">{script.generatedScript}</p>
                      <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-gray-50 to-transparent" />
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          setGeneratedCopy(script.generatedScript);
                          setAppSubTab('copy');
                          setActiveTab('app');
                        }}
                        className="flex-1 py-3 bg-black text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
                      >
                        <Eye className="w-3 h-3" />
                        Ver e Editar
                      </button>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(script.generatedScript);
                        }}
                        className="p-3 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-all"
                        title="Copiar Script"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
            </div>

            {whatsappScripts.length === 0 && (
              <div className="text-center py-24 bg-white rounded-[3rem] border border-dashed border-gray-200">
                <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <MessageSquare className="w-10 h-10 text-gray-200" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Histórico Vazio</h3>
                <p className="text-gray-500 max-w-xs mx-auto mb-8">Você ainda não gerou nenhum script de automação.</p>
              </div>
            )}
          </div>
        ) : (
          /* Micro SaaS View */
          <div className="space-y-8">
            {/* Sub-navigation */}
            <div className="flex flex-wrap gap-4 border-b border-gray-200 pb-4">
              <button 
                onClick={() => setAppSubTab('simulator')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${appSubTab === 'simulator' ? 'bg-black text-white shadow-lg' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                <Calculator className="w-4 h-4" />
                Simulador de Vendas
              </button>
              <button 
                onClick={() => setAppSubTab('pricing')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${appSubTab === 'pricing' ? 'bg-black text-white shadow-lg' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                <DollarSign className="w-4 h-4" />
                Precificação de Vendas por procedimento
              </button>
              <button 
                onClick={() => setAppSubTab('copy')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${appSubTab === 'copy' ? 'bg-black text-white shadow-lg' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                <MessageSquare className="w-4 h-4" />
                Automações e Scripts
              </button>
            </div>

            <AnimatePresence mode="wait">
              {appSubTab === 'simulator' && (
                <motion.div 
                  key="simulator"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="grid grid-cols-1 lg:grid-cols-2 gap-0 bg-white rounded-3xl overflow-hidden shadow-2xl shadow-gray-200 border border-gray-100"
                >
                  {/* Left Side: Inputs */}
                  <div className="p-8 lg:p-12 border-r border-gray-100 bg-white">
                    <div className="flex items-center gap-2 mb-8">
                      <Calculator className="w-5 h-5 text-gray-400" />
                      <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500">Parâmetros de Entrada</h2>
                    </div>

                    <div className="space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <InputGroup 
                          label="Investimento por Mês" 
                          icon={<DollarSign className="w-4 h-4" />}
                          value={investment}
                          onChange={setInvestment}
                          prefix="R$"
                        />
                        <InputGroup 
                          label="Custo por Lead" 
                          icon={<Users className="w-4 h-4" />}
                          value={costPerLead}
                          onChange={setCostPerLead}
                          prefix="R$"
                        />
                      </div>

                      <div className="bg-gray-50 p-4 rounded-xl border border-dashed border-gray-200 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-white rounded-lg shadow-sm">
                            <Target className="w-4 h-4 text-blue-500" />
                          </div>
                          <span className="text-sm font-medium text-gray-600">Leads Recebidos</span>
                        </div>
                        <span className="text-xl font-mono font-bold">{formatNumber(leads)}</span>
                      </div>

                      <div className="space-y-6">
                        <SliderGroup 
                          label="Taxa de Agendamento" 
                          icon={<Calendar className="w-4 h-4" />}
                          value={appointmentRate}
                          onChange={setAppointmentRate}
                          suffix="%"
                          color="bg-blue-500"
                        />
                        
                        <div className="flex justify-between items-center px-2 py-1 bg-blue-50 rounded-lg">
                          <span className="text-xs font-semibold text-blue-600 uppercase">Clientes Agendados</span>
                          <span className="text-sm font-mono font-bold text-blue-700">{formatNumber(scheduledClients)}</span>
                        </div>

                        <SliderGroup 
                          label="Taxa de Comparecimento" 
                          icon={<CheckCircle className="w-4 h-4" />}
                          value={attendanceRate}
                          onChange={setAttendanceRate}
                          suffix="%"
                          color="bg-indigo-500"
                        />

                        <SliderGroup 
                          label="Conversão de Vendas" 
                          icon={<Target className="w-4 h-4" />}
                          value={conversionRate}
                          onChange={setConversionRate}
                          suffix="%"
                          color="bg-emerald-500"
                        />

                        <InputGroup 
                          label="Ticket Médio" 
                          icon={<DollarSign className="w-4 h-4" />}
                          value={averageTicket}
                          onChange={setAverageTicket}
                          prefix="R$"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Results */}
                  <div className="p-8 lg:p-12 bg-[#151619] text-white flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-12">
                        <PieChart className="w-5 h-5 text-gray-500" />
                        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500">Resultado Final</h2>
                      </div>

                      <div className="space-y-10">
                        <motion.div 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="space-y-2"
                        >
                          <span className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500">Faturamento Recebido</span>
                          <div className="text-5xl lg:text-6xl font-light tracking-tighter text-white">
                            {formatCurrency(revenue)}
                          </div>
                        </motion.div>

                        <div className="grid grid-cols-2 gap-8 pt-10 border-t border-white/10">
                          <ResultItem 
                            label="Número de Vendas" 
                            value={formatNumber(salesCount)} 
                            icon={<ArrowRight className="w-4 h-4 text-emerald-400" />}
                          />
                          <ResultItem 
                            label="Retorno (ROI)" 
                            value={`${formatNumber(roi)}%`} 
                            icon={<TrendingUp className="w-4 h-4 text-blue-400" />}
                            subValue={roi > 0 ? `${(roi/100).toFixed(1)}x o investimento` : undefined}
                          />
                        </div>

                        <motion.div 
                          layout
                          className={`p-6 rounded-2xl border ${profit >= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}
                        >
                          <div className="flex justify-between items-end">
                            <div className="space-y-1">
                              <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Lucro do Procedimento</span>
                              <div className={`text-3xl font-bold ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {formatCurrency(profit)}
                              </div>
                            </div>
                            <div className={`p-3 rounded-full ${profit >= 0 ? 'bg-emerald-500 text-black' : 'bg-red-500 text-white'}`}>
                              <DollarSign className="w-6 h-6" />
                            </div>
                          </div>
                        </motion.div>

                        <button 
                          onClick={() => {
                            setAppSubTab('copy');
                            setActiveTab('app');
                          }}
                          className="w-full mt-8 py-4 bg-emerald-500 text-black rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-emerald-400 transition-all flex items-center justify-center gap-2"
                        >
                          <MessageSquare className="w-5 h-5" />
                          Start Automação
                        </button>
                      </div>
                    </div>

                    <div className="mt-12 pt-8 border-t border-white/5 flex items-start gap-3 text-gray-500">
                      <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <p className="text-[10px] leading-relaxed uppercase tracking-wider">
                        Este simulador é uma ferramenta de projeção baseada em taxas médias. 
                        Os resultados reais podem variar de acordo com a sazonalidade, 
                        qualidade do atendimento e mercado local.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {appSubTab === 'pricing' && (
                <motion.div 
                  key="pricing"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="grid grid-cols-1 lg:grid-cols-2 gap-0 bg-white rounded-3xl overflow-hidden shadow-2xl shadow-gray-200 border border-gray-100"
                >
                  <div className="p-8 lg:p-12 border-r border-gray-100 bg-white">
                    <div className="flex items-center gap-2 mb-8">
                      <Calculator className="w-5 h-5 text-gray-400" />
                      <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500">Precificação de Vendas por procedimento</h2>
                    </div>
                    
                    <div className="space-y-6">
                      <InputGroup 
                        label="Custo do Procedimento (Insumos)" 
                        icon={<CheckSquare className="w-4 h-4" />}
                        value={procedureCost}
                        onChange={setProcedureCost}
                        prefix="R$"
                      />
                      <InputGroup 
                        label="Custo de Marketing (por venda)" 
                        icon={<Target className="w-4 h-4" />}
                        value={marketingCost}
                        onChange={setMarketingCost}
                        prefix="R$"
                      />
                      <InputGroup 
                        label="Custos Fixos Rateados" 
                        icon={<FileText className="w-4 h-4" />}
                        value={fixedCosts}
                        onChange={setFixedCosts}
                        prefix="R$"
                      />
                      <SliderGroup 
                        label="Margem de Lucro Desejada" 
                        icon={<TrendingUp className="w-4 h-4" />}
                        value={desiredProfitMargin}
                        onChange={setDesiredProfitMargin}
                        suffix="%"
                        color="bg-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="p-8 lg:p-12 bg-[#151619] text-white flex flex-col justify-center items-center text-center">
                    <div className="space-y-6">
                      <div className="p-4 bg-white/5 rounded-full inline-block mb-4">
                        <DollarSign className="w-12 h-12 text-emerald-400" />
                      </div>
                      <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500">Preço Mínimo Sugerido</h3>
                      <div className="text-6xl font-light tracking-tighter text-white">
                        {formatCurrency(suggestedPrice)}
                      </div>
                      <p className="text-sm text-gray-400 max-w-xs mx-auto">
                        Este é o valor que você deve cobrar para cobrir todos os custos e garantir sua margem de {desiredProfitMargin}%.
                      </p>
                      <button 
                        onClick={() => {
                          setAppSubTab('copy');
                          setActiveTab('app');
                        }}
                        className="w-full mt-8 py-4 bg-emerald-500 text-black rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-emerald-400 transition-all flex items-center justify-center gap-2"
                      >
                        <MessageSquare className="w-5 h-5" />
                        Start Automação
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {appSubTab === 'copy' && (
                <motion.div 
                  key="copy"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="grid grid-cols-1 lg:grid-cols-2 gap-0 bg-white rounded-3xl overflow-hidden shadow-2xl shadow-gray-200 border border-gray-100"
                >
                  <div className="p-8 lg:p-12 border-r border-gray-100 bg-white">
                    <div className="flex items-center gap-2 mb-8">
                      <MessageSquare className="w-5 h-5 text-gray-400" />
                      <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500">Automações e Scripts</h2>
                    </div>

                    <div className="space-y-6">
                      {whatsappTab === 'generator' && (
                        <div className="space-y-2">
                          <div className="flex gap-2 p-1 bg-black/5 rounded-xl border border-black/5">
                            <button 
                              onClick={() => setWhatsappSubtype('qualificacao')}
                              className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${whatsappSubtype === 'qualificacao' ? 'bg-black text-white shadow-sm' : 'text-gray-400'}`}
                            >
                              Anúncios Qualificação
                            </button>
                            <button 
                              onClick={() => setWhatsappSubtype('direto')}
                              className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${whatsappSubtype === 'direto' ? 'bg-black text-white shadow-sm' : 'text-gray-400'}`}
                            >
                              Anúncios Direto
                            </button>
                          </div>
                          <p className="text-[10px] text-gray-400 px-1 italic">
                            {whatsappSubtype === 'qualificacao' 
                              ? "Focado em filtrar leads e gerar autoridade antes do agendamento." 
                              : "Focado em resposta rápida para leads que já demonstraram interesse direto."}
                          </p>
                        </div>
                      )}

                      {whatsappTab === 'generator' && (
                        <div className="space-y-4">
                          <div className="p-4 bg-black/5 rounded-2xl border border-black/5">
                            <h3 className="text-[10px] font-bold uppercase tracking-widest text-black mb-4">Informações da Clínica</h3>
                            <div className="grid grid-cols-2 gap-3 mb-4">
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Nome da Clínica</label>
                                <input 
                                  type="text" 
                                  value={clinicName}
                                  onChange={(e) => setClinicName(e.target.value)}
                                  placeholder="Ex: Baronesa Estética"
                                  className="w-full bg-white border border-gray-200 rounded-xl py-2 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-black/5"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Nome do Profissional</label>
                                <input 
                                  type="text" 
                                  value={professionalName}
                                  onChange={(e) => setProfessionalName(e.target.value)}
                                  placeholder="Ex: Dra. Brunna"
                                  className="w-full bg-white border border-gray-200 rounded-xl py-2 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-black/5"
                                />
                              </div>
                            </div>

                            {whatsappSubtype === 'qualificacao' ? (
                              <>
                                <div className="space-y-1 mb-4">
                                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Vidas Ajudadas (Número)</label>
                                  <input 
                                    type="text" 
                                    value={livesHelped}
                                    onChange={(e) => setLivesHelped(e.target.value)}
                                    placeholder="Ex: 287"
                                    className="w-full bg-white border border-gray-200 rounded-xl py-2 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-black/5"
                                  />
                                </div>

                                <h3 className="text-[10px] font-bold uppercase tracking-widest text-black mb-4 mt-6">Frase de Posicionamento / Matadora</h3>
                                <div className="space-y-4">
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Desejo/Medos/Frustações/Transformação</label>
                                    <textarea 
                                      value={desiresFears}
                                      onChange={(e) => setDesiresFears(e.target.value)}
                                      placeholder="Ex: Emagrecer 15kg em 30 dias"
                                      className="w-full bg-white border border-gray-200 rounded-xl py-2 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-black/5 h-16 resize-none"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Nome do Método</label>
                                    <input 
                                      type="text" 
                                      value={methodName}
                                      onChange={(e) => setMethodName(e.target.value)}
                                      placeholder="Ex: Protocolo Baronesa Slim"
                                      className="w-full bg-white border border-gray-200 rounded-xl py-2 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-black/5"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Curiosidade sobre o procedimento</label>
                                    <input 
                                      type="text" 
                                      value={curiosity}
                                      onChange={(e) => setCuriosity(e.target.value)}
                                      placeholder="Ex: Ativos hormonais GIP e GLP1"
                                      className="w-full bg-white border border-gray-200 rounded-xl py-2 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-black/5"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Quebra de Objeção</label>
                                    <input 
                                      type="text" 
                                      value={objection}
                                      onChange={(e) => setObjection(e.target.value)}
                                      placeholder="Ex: Mesmo que já tenha feito bariátrica"
                                      className="w-full bg-white border border-gray-200 rounded-xl py-2 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-black/5"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Presente/Bônus (Agendamento Imediato)</label>
                                    <input 
                                      type="text" 
                                      value={bonusGift}
                                      onChange={(e) => setBonusGift(e.target.value)}
                                      placeholder="Ex: Peeling de Pérolas (R$ 250)"
                                      className="w-full bg-white border border-gray-200 rounded-xl py-2 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-black/5"
                                    />
                                  </div>
                                </div>
                              </>
                            ) : (
                              <>
                                <h3 className="text-[10px] font-bold uppercase tracking-widest text-black mb-4 mt-6">Detalhes do Procedimento (Anúncio Direto)</h3>
                                <div className="space-y-4">
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Nome do Método / Procedimento</label>
                                    <input 
                                      type="text" 
                                      value={methodName}
                                      onChange={(e) => setMethodName(e.target.value)}
                                      placeholder="Ex: LIMPEZA DE PELE PREMIUM"
                                      className="w-full bg-white border border-gray-200 rounded-xl py-2 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-black/5"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">O que fazemos no procedimento (Lista)</label>
                                    <textarea 
                                      value={procedureSteps}
                                      onChange={(e) => setProcedureSteps(e.target.value)}
                                      placeholder="Ex: Higienização, Esfoliação, Extração de cravos..."
                                      className="w-full bg-white border border-gray-200 rounded-xl py-2 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-black/5 h-20 resize-none"
                                    />
                                    <p className="text-[9px] text-gray-400 italic">Dica: Separe por vírgulas para a IA criar os checkmarks.</p>
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Dado de Qualificação Solicitado</label>
                                    <input 
                                      type="text" 
                                      value={qualificationData}
                                      onChange={(e) => setQualificationData(e.target.value)}
                                      placeholder="Ex: tipo de pele (Seca, Oleosa...)"
                                      className="w-full bg-white border border-gray-200 rounded-xl py-2 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-black/5"
                                    />
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      <button 
                        onClick={generateCopy}
                        disabled={
                          isGenerating || 
                          (whatsappSubtype === 'qualificacao' 
                            ? (!desiresFears || !methodName || !curiosity || !objection || !clinicName || !professionalName || !livesHelped || !bonusGift)
                            : (!methodName || !procedureSteps || !qualificationData || !clinicName || !professionalName))
                        }
                        className="w-full bg-black text-white rounded-2xl py-4 font-bold text-sm tracking-widest uppercase hover:bg-gray-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Gerar Script com IA
                      </button>
                    </div>
                  </div>

                  <div className="p-8 lg:p-12 bg-[#151619] text-white overflow-y-auto max-h-[600px]">
                    <div className="flex items-center gap-2 mb-8">
                      <FileText className="w-5 h-5 text-gray-500" />
                      <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500">Script Gerado</h2>
                    </div>

                    {generatedCopy ? (
                      <div className="bg-white/5 p-6 rounded-2xl border border-white/10 whitespace-pre-wrap text-sm leading-relaxed text-gray-300 font-sans">
                        {generatedCopy}
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-30">
                        <MessageSquare className="w-12 h-12" />
                        <p className="text-xs uppercase tracking-widest">Preencha os campos e clique em gerar</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </main>

      {isAddUserModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
          >
            <div className="p-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">Adicionar Usuário</h3>
                <button onClick={() => {
                  setIsAddUserModalOpen(false);
                  setAddUserSuccess(false);
                  setNewUserEmail('');
                }} className="text-gray-400 hover:text-black transition-colors">
                  <UserX className="w-6 h-6" />
                </button>
              </div>

              {!addUserSuccess ? (
                <form onSubmit={handleAddUser} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">E-mail do Usuário</label>
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input 
                        type="email" 
                        required
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        placeholder="exemplo@email.com"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-black/5"
                      />
                    </div>
                  </div>

                  {authError && (
                    <div className="p-4 bg-red-50 rounded-xl flex items-start gap-3 text-red-600 text-xs">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{authError}</span>
                    </div>
                  )}

                  <button 
                    type="submit"
                    disabled={isAddingUser}
                    className="w-full bg-black text-white rounded-xl py-4 font-bold text-sm tracking-widest uppercase hover:bg-gray-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isAddingUser ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                    {isAddingUser ? 'Adicionando...' : 'Confirmar Acesso'}
                  </button>
                </form>
              ) : (
                <div className="space-y-6 text-center py-4">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Usuário Adicionado!</h4>
                    <p className="text-sm text-gray-500 mt-1">O acesso foi configurado com sucesso.</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-left">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Senha Provisória</div>
                    <div className="font-mono text-lg font-bold text-gray-900 tracking-wider">{generatedPassword}</div>
                    <p className="text-[10px] text-gray-400 mt-2 italic">* Informe esta senha ao usuário. Ele poderá alterá-la no primeiro acesso.</p>
                  </div>
                  <button 
                    onClick={() => {
                      setIsAddUserModalOpen(false);
                      setAddUserSuccess(false);
                    }}
                    className="w-full bg-black text-white rounded-xl py-4 font-bold text-sm tracking-widest uppercase hover:bg-gray-800 transition-all"
                  >
                    Concluir
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function InputGroup({ label, icon, value, onChange, prefix }: { 
  label: string; 
  icon: React.ReactNode; 
  value: number; 
  onChange: (val: number) => void;
  prefix?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
        {icon}
        {label}
      </label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-mono text-sm">
            {prefix}
          </span>
        )}
        <input 
          type="number" 
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`w-full bg-gray-50 border border-gray-200 rounded-xl py-3 ${prefix ? 'pl-12' : 'px-4'} pr-4 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all`}
        />
      </div>
    </div>
  );
}

function SliderGroup({ label, icon, value, onChange, suffix, color }: { 
  label: string; 
  icon: React.ReactNode; 
  value: number; 
  onChange: (val: number) => void;
  suffix?: string;
  color: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
          {icon}
          {label}
        </label>
        <span className="text-sm font-mono font-bold">{value}{suffix}</span>
      </div>
      <div className="relative h-2 w-full bg-gray-100 rounded-full overflow-hidden">
        <div 
          className={`absolute top-0 left-0 h-full ${color} transition-all duration-300`}
          style={{ width: `${value}%` }}
        />
        <input 
          type="range" 
          min="0" 
          max="100" 
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
      </div>
    </div>
  );
}

function ResultItem({ label, value, icon, subValue }: { 
  label: string; 
  value: string; 
  icon: React.ReactNode;
  subValue?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</span>
      </div>
      <div className="text-3xl font-light tracking-tight">{value}</div>
      {subValue && <div className="text-[10px] text-gray-500 font-mono">{subValue}</div>}
    </div>
  );
}
