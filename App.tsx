import React, { useState, useEffect, useRef } from 'react';
import { VOICES } from './constants';
import { TTSStatus, GeneratedAudio } from './types';
import { generateSpeech } from './services/geminiService';
import VoiceSelector from './components/VoiceSelector';
import OutputPlayer from './components/OutputPlayer';

// Gemini Free Tier Limits
const DAILY_REQUEST_LIMIT = 1500; 
const MINUTE_REQUEST_LIMIT = 15; // RPM Limit

const App: React.FC = () => {
  // Default to 'Kore' or the first available voice if Kore isn't found
  const defaultVoice = VOICES.find(v => v.id === "Kore")?.id || VOICES[0].id;
  
  const [selectedVoice, setSelectedVoice] = useState<string>(defaultVoice);
  const [text, setText] = useState<string>('');
  const [targetDuration, setTargetDuration] = useState<string>(''); 
  const [status, setStatus] = useState<TTSStatus>(TTSStatus.IDLE);
  const [generatedAudio, setGeneratedAudio] = useState<GeneratedAudio | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // --- Usage State ---
  const [dailyRequests, setDailyRequests] = useState<number>(0);
  const [minuteRequests, setMinuteRequests] = useState<number>(0);
  const [secondsUntilReset, setSecondsUntilReset] = useState<number>(60);

  // --- Initialization & Timers ---
  useEffect(() => {
    // 1. Load Daily Usage
    const today = new Date().toISOString().split('T')[0];
    const storageKey = `gemini_tts_usage_${today}`;
    const savedUsage = localStorage.getItem(storageKey);
    if (savedUsage) {
        setDailyRequests(parseInt(savedUsage, 10));
    } else {
        setDailyRequests(0);
    }

    // 2. Start the Minute Timer (Live Update)
    const timer = setInterval(() => {
        setSecondsUntilReset((prev) => {
            if (prev <= 1) {
                // Minute is over, reset the minute counter
                setMinuteRequests(0);
                return 60;
            }
            return prev - 1;
        });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const incrementUsage = () => {
    // Update Daily
    const today = new Date().toISOString().split('T')[0];
    const storageKey = `gemini_tts_usage_${today}`;
    const newDailyCount = dailyRequests + 1;
    setDailyRequests(newDailyCount);
    localStorage.setItem(storageKey, newDailyCount.toString());

    // Update Minute
    setMinuteRequests(prev => prev + 1);
  };

  const handleGenerate = async () => {
    if (!text.trim()) {
        setErrorMsg("Please enter some text to generate speech.");
        return;
    }

    // --- PREVENTIVE CHECKS (Client Side Rate Limiting) ---
    if (dailyRequests >= DAILY_REQUEST_LIMIT) {
        setErrorMsg("Daily limit reached (1500). Please try tomorrow or use a paid key.");
        return;
    }

    if (minuteRequests >= MINUTE_REQUEST_LIMIT) {
        setErrorMsg(`Speed limit reached! Please wait ${secondsUntilReset} seconds for the minute quota to reset.`);
        return;
    }
    
    setErrorMsg(null);
    setStatus(TTSStatus.GENERATING);
    setGeneratedAudio(null);

    try {
      const result = await generateSpeech(text, selectedVoice);
      setGeneratedAudio(result);
      setStatus(TTSStatus.SUCCESS);
      incrementUsage();
    } catch (err: any) {
      console.error(err);
      setStatus(TTSStatus.ERROR);
      
      // Handle 429 Quota Exceeded specifically
      if (err.message?.includes('429') || err.status === 429 || err.message?.includes('RESOURCE_EXHAUSTED')) {
        setErrorMsg("Quota exceeded (429). The system is busy. Please wait a moment.");
      } else {
        setErrorMsg(err.message || "Failed to generate speech. Please try again.");
      }
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    if (errorMsg) setErrorMsg(null);
  };

  const handleChangeApiKey = async () => {
    if (window.aistudio?.openSelectKey) {
      // 1. Open the Key Selector
      await window.aistudio.openSelectKey();
      
      // 2. Reset the App State for the new Key
      setErrorMsg(null);
      setStatus(TTSStatus.IDLE);
      
      // 3. Reset Usage Counters so the new key works immediately without "limit reached" blocks
      setDailyRequests(0);
      setMinuteRequests(0);
      setSecondsUntilReset(60);
      
      // 4. Clear Storage
      const today = new Date().toISOString().split('T')[0];
      localStorage.removeItem(`gemini_tts_usage_${today}`);
      
      // Optional: Give visual feedback
      alert("API Key updated. Usage counters have been reset.");
    } else {
      alert("API Key selection is not available in this environment.");
    }
  };

  // --- Calculations for UI ---
  const dailyRemaining = DAILY_REQUEST_LIMIT - dailyRequests;
  const dailyPercentage = Math.min(100, (dailyRequests / DAILY_REQUEST_LIMIT) * 100);
  
  const minuteRemaining = MINUTE_REQUEST_LIMIT - minuteRequests;
  const isMinuteFull = minuteRemaining <= 0;

  let barColor = "bg-blue-500";
  if (dailyPercentage > 75) barColor = "bg-yellow-500";
  if (dailyPercentage > 90) barColor = "bg-red-500";

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 selection:bg-blue-500/30">
      {/* Header */}
      <header className="border-b border-slate-800 bg-[#0f172a]/90 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white">
                    <path fillRule="evenodd" d="M19.5 9.75a.75.75 0 0 1-.75.75h-3a3.75 3.75 0 0 0-3.75 3.75v.75A2.25 2.25 0 0 1 9.75 17.25H5.25a2.25 2.25 0 0 1-2.25-2.25V8.25a2.25 2.25 0 0 1 2.25-2.25h10.5a2.25 2.25 0 0 1 2.25 2.25v1.5Z" clipRule="evenodd" />
                    <path fillRule="evenodd" d="M18.97 7.455c.22.055.44.111.658.171 1.664.476 2.872 2.001 2.872 3.757v.375c0 1.37-.8 2.596-1.998 3.208-.076.623-.197 1.23-.362 1.822a.75.75 0 0 1-1.453-.387c.137-.514.238-1.04.302-1.576.059-.49.07-.97.037-1.442-.424-.037-.84-.08-1.248-.13a1.5 1.5 0 0 0-1.578 1.056l-.078.234a1.5 1.5 0 1 1-2.844-.948l.077-.233c.184-.552.613-.996 1.15-1.185.783-.277 1.63-.12 2.304.308.283-.55.626-1.071 1.018-1.549-.396-.582-.693-1.21-.884-1.859a1.5 1.5 0 1 1 2.845-.948l.077.233c.057.172.094.349.11.528-.593-.05-1.192-.08-1.794-.093a6.046 6.046 0 0 1-.506-1.294Z" clipRule="evenodd" />
                </svg>
             </div>
             <div>
                <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                    Gemini TTS
                </h1>
                <div className="text-[10px] text-slate-500 font-mono hidden sm:block">
                    RPM Protection Active
                </div>
             </div>
          </div>
          
          <div className="flex items-center gap-4">
             
             {/* MINUTE LIMIT (RPM) TRACKER */}
             <div className="flex flex-col items-end border-r border-slate-700 pr-4 mr-2">
                 <div className="flex items-center gap-2 text-xs font-mono mb-1">
                    <span className="text-slate-400">Speed Limit:</span>
                    <span className={`font-bold ${isMinuteFull ? 'text-red-400' : 'text-blue-400'}`}>
                        {minuteRemaining} left
                    </span>
                 </div>
                 <div className="flex items-center gap-2">
                    <div className="w-16 h-1 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                            className={`h-full ${isMinuteFull ? 'bg-red-500' : 'bg-blue-500'}`} 
                            style={{ width: `${(minuteRequests / MINUTE_REQUEST_LIMIT) * 100}%` }}
                        ></div>
                    </div>
                    <span className="text-[10px] text-slate-500 w-8 text-right">{secondsUntilReset}s</span>
                 </div>
             </div>

             {/* DAILY LIMIT TRACKER */}
             <div className="flex flex-col items-end mr-2 hidden sm:flex">
                 <div className="flex items-center gap-2 text-xs font-medium text-slate-300 mb-1">
                    <span>Daily Credit:</span>
                    <span className={dailyRemaining < 100 ? "text-red-400" : "text-green-400"}>
                        {dailyRemaining}
                    </span>
                 </div>
                 <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                    <div 
                        className={`h-full rounded-full transition-all duration-500 ${barColor}`} 
                        style={{ width: `${dailyPercentage}%` }}
                    ></div>
                 </div>
             </div>

             <button
               onClick={handleChangeApiKey}
               className="flex items-center gap-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-lg border border-slate-700 transition-colors"
             >
               <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-yellow-500">
                 <path fillRule="evenodd" d="M15.75 1.5a6.75 6.75 0 0 0-6.651 7.906c.067.39-.032.717-.221.906l-6.5 6.499a3 3 0 0 0-.878 2.121v2.818c0 .414.336.75.75.75h2.818a3 3 0 0 0 2.122-.878l6.499-6.499c.189-.189.516-.288.906-.221A6.75 6.75 0 1 0 15.75 1.5Zm0 3a.75.75 0 0 0 0 1.5h1.5a.75.75 0 0 0 0-1.5h-1.5Z" clipRule="evenodd" />
               </svg>
               <span className="hidden sm:inline">Change Key</span>
             </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Sidebar: Settings */}
          <div className="lg:col-span-4 space-y-8">
            <VoiceSelector 
                voices={VOICES} 
                selectedVoice={selectedVoice} 
                onSelect={setSelectedVoice} 
            />

            {/* Info Card */}
            <div className="bg-slate-800/40 border border-slate-700/50 p-4 rounded-xl text-sm text-slate-400">
              <div className="flex items-start gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-blue-400 mt-0.5 shrink-0">
                    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm11.378-3.917c-.89-.777-2.366-.777-3.255 0a.75.75 0 0 1-.988-1.129c1.454-1.272 3.776-1.272 5.23 0 1.513 1.324 1.513 3.518 0 4.842a3.75 3.75 0 0 1-.837.552c-.676.328-1.028.774-1.028 1.152v.75a.75.75 0 0 1-1.5 0v-.75c0-1.279 1.06-2.107 1.875-2.502.182-.088.351-.199.503-.331.83-.727.83-1.857 0-2.584ZM12 18a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
                  </svg>
                  <div>
                      <p className="mb-2 font-semibold text-slate-300">How limits work</p>
                      <ul className="list-disc pl-4 space-y-1 text-xs">
                          <li><span className="text-blue-400">Daily:</span> 1,500 requests per day.</li>
                          <li><span className="text-blue-400">Speed (RPM):</span> 15 requests per minute.</li>
                      </ul>
                      <p className="mt-2 text-xs opacity-75">
                          The timer in the header resets your "Speed Limit" every 60s to prevent 429 errors.
                      </p>
                  </div>
              </div>
            </div>
          </div>

          {/* Right Content: Input & Output */}
          <div className="lg:col-span-8 flex flex-col h-full">
            <div className="flex-1 flex flex-col relative">
                <div className="flex items-center justify-between mb-4">
                  <label className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                      Input Text
                  </label>
                  <div className="flex items-center gap-2">
                     <label className="text-xs text-slate-400">Target Duration (min):</label>
                     <input 
                        type="number" 
                        min="0.1" 
                        step="0.1"
                        placeholder="Ex: 15"
                        value={targetDuration}
                        onChange={(e) => setTargetDuration(e.target.value)}
                        className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-sm text-slate-200 focus:outline-none focus:border-blue-500 text-center"
                     />
                  </div>
                </div>
                
                <div className="relative flex-1 group">
                    <textarea
                        value={text}
                        onChange={handleTextChange}
                        placeholder="Write or paste your article here to generate speech..."
                        className="w-full h-[400px] lg:h-full bg-slate-900/50 border border-slate-700 rounded-xl p-6 text-base leading-relaxed text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none transition-all scrollbar-thin"
                    />
                    <div className="absolute bottom-4 right-4 text-xs text-slate-600 font-mono bg-slate-900/80 px-2 py-1 rounded">
                        {text.length} chars
                    </div>
                </div>

                {errorMsg && (
                    <div className="mt-4 p-4 bg-red-900/20 border border-red-800/50 rounded-lg flex items-start gap-3 text-red-400 animate-fade-in">
                         <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0 mt-0.5">
                            <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
                         </svg>
                         <div className="flex flex-col gap-1">
                           <span className="font-semibold">Attention:</span>
                           <span>{errorMsg}</span>
                           {errorMsg.includes('Quota exceeded') && (
                             <button 
                               onClick={handleChangeApiKey}
                               className="text-blue-400 hover:text-blue-300 underline text-left mt-1 w-fit"
                             >
                               Click here to change API Key
                             </button>
                           )}
                         </div>
                    </div>
                )}

                {/* Controls Bar */}
                <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                     <p className="text-xs text-slate-500 hidden sm:block">
                        Output Format: MP3 (24kHz Mono)
                     </p>
                     
                     <button
                        onClick={handleGenerate}
                        disabled={status === TTSStatus.GENERATING || !text.trim() || isMinuteFull}
                        className={`
                            w-full sm:w-auto px-8 py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transition-all
                            ${status === TTSStatus.GENERATING || !text.trim() || isMinuteFull
                                ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
                                : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-blue-500/25 hover:scale-[1.02] active:scale-[0.98]'
                            }
                        `}
                     >
                        {isMinuteFull ? (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 animate-pulse text-red-400">
                                  <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm0 8.625a1.125 1.125 0 1 0 0 2.25 1.125 1.125 0 0 0 0-2.25ZM15.375 12a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0ZM7.5 10.875a1.125 1.125 0 1 0 0 2.25 1.125 1.125 0 0 0 0-2.25Z" clipRule="evenodd" />
                                </svg>
                                <span>Wait {secondsUntilReset}s</span>
                            </>
                        ) : status === TTSStatus.GENERATING ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Generating...
                            </>
                        ) : (
                            <>
                                <span>Generate Speech</span>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                    <path d="M11.644 1.59a.75.75 0 0 1 .712 0l9.75 5.25a.75.75 0 0 1 0 1.32l-9.75 5.25a.75.75 0 0 1-.712 0l-9.75-5.25a.75.75 0 0 1 0-1.32l9.75-5.25Z" />
                                    <path d="m3.265 10.602 7.668 4.129a2.25 2.25 0 0 0 2.134 0l7.668-4.13 1.37.739a.75.75 0 0 1 0 1.32l-9.75 5.25a.75.75 0 0 1-.712 0l-9.75-5.25a.75.75 0 0 1 0-1.32l1.37-.738Z" />
                                    <path d="m10.933 19.231-7.668-4.13-1.37.739a.75.75 0 0 0 0 1.32l9.75 5.25a.75.75 0 0 0 .712 0l9.75-5.25a.75.75 0 0 0 0-1.32l-1.37-.738-7.668 4.13a2.25 2.25 0 0 1-2.134 0Z" />
                                </svg>
                            </>
                        )}
                     </button>
                </div>

                {generatedAudio && (
                    <OutputPlayer 
                      audio={generatedAudio} 
                      targetDuration={targetDuration ? parseFloat(targetDuration) : undefined}
                    />
                )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;