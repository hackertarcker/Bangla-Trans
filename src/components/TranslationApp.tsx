import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  FileVideo, 
  FileAudio, 
  Languages, 
  Play, 
  Download, 
  Settings, 
  History,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  Volume2,
  Subtitles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { 
  auth, 
  db, 
  storage, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  addDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  ref, 
  uploadBytes, 
  getDownloadURL,
  handleFirestoreError,
  OperationType,
  User
} from '../lib/firebase';
import { serverTimestamp, Timestamp } from 'firebase/firestore';

export default function TranslationApp() {
  const [user, setUser] = useState<User | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'completed' | 'error'>('idle');
  const [sourceLang, setSourceLang] = useState('en');
  const [targetLang, setTargetLang] = useState('bn');
  const [jobs, setJobs] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Sync user to Firestore
        const userRef = doc(db, 'users', currentUser.uid);
        setDoc(userRef, {
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName,
          photoURL: currentUser.photoURL,
          createdAt: serverTimestamp(),
        }, { merge: true });

        // Listen to jobs
        const jobsQuery = query(
          collection(db, 'jobs'),
          where('userId', '==', currentUser.uid),
          orderBy('createdAt', 'desc')
        );
        onSnapshot(jobsQuery, (snapshot) => {
          setJobs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, 'jobs');
        });
      } else {
        setJobs([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success('Logged in successfully');
    } catch (error) {
      toast.error('Login failed');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success('Logged out');
    } catch (error) {
      toast.error('Logout failed');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatus('idle');
    }
  };

  const startTranslation = async () => {
    if (!file || !user) return;

    setIsUploading(true);
    setStatus('uploading');
    setProgress(0);

    try {
      // 1. Create Job in Firestore
      const jobRef = await addDoc(collection(db, 'jobs'), {
        userId: user.uid,
        fileName: file.name,
        fileType: file.type.startsWith('video') ? 'video' : 'audio',
        sourceLang,
        targetLang,
        status: 'uploading',
        progress: 0,
        createdAt: serverTimestamp(),
      });

      // 2. Upload to Storage
      const storageRef = ref(storage, `uploads/${user.uid}/${jobRef.id}/${file.name}`);
      const uploadTask = uploadBytes(storageRef, file);
      
      // Simulate progress for UI
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          const next = prev + 10;
          updateDoc(jobRef, { progress: next });
          return next;
        });
      }, 500);

      await uploadTask;
      const downloadUrl = await getDownloadURL(storageRef);

      // 3. Update Job
      await updateDoc(jobRef, {
        status: 'processing',
        progress: 100,
        originalFileUrl: downloadUrl
      });

      setStatus('processing');
      setProgress(100);
      
      // Simulate backend processing
      setTimeout(() => {
        setStatus('completed');
        updateDoc(jobRef, { status: 'completed' });
        toast.success('Translation completed!');
      }, 3000);

    } catch (error) {
      console.error(error);
      setStatus('error');
      toast.error('Translation failed');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
              <Languages className="w-8 h-8 text-orange-500" />
              BanglaTrans
            </h1>
            <p className="text-zinc-400">AI-Powered Audio & Video Translation</p>
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium">{user.displayName}</p>
                  <p className="text-xs text-zinc-500">{user.email}</p>
                </div>
                <img src={user.photoURL || ''} className="w-8 h-8 rounded-full border border-zinc-800" referrerPolicy="no-referrer" />
                <Button variant="outline" size="sm" onClick={handleLogout} className="bg-zinc-900 border-zinc-800 hover:bg-zinc-800">
                  Logout
                </Button>
              </div>
            ) : (
              <Button onClick={handleLogin} className="bg-orange-600 hover:bg-orange-700 text-white">
                Login with Google
              </Button>
            )}
          </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upload Section */}
          <Card className="lg:col-span-2 bg-zinc-900/50 border-zinc-800 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Translate New Content</CardTitle>
              <CardDescription>Upload your video or audio file to start translation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`
                  border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all
                  ${file ? 'border-orange-500/50 bg-orange-500/5' : 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50'}
                `}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                  accept="video/*,audio/*"
                />
                {file ? (
                  <div className="flex flex-col items-center gap-2">
                    {file.type.startsWith('video') ? (
                      <FileVideo className="w-12 h-12 text-orange-500" />
                    ) : (
                      <FileAudio className="w-12 h-12 text-orange-500" />
                    )}
                    <span className="font-medium text-zinc-200">{file.name}</span>
                    <span className="text-xs text-zinc-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                  </div>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center">
                      <Upload className="w-8 h-8 text-zinc-400" />
                    </div>
                    <div className="text-center">
                      <p className="font-medium">Click or drag to upload</p>
                      <p className="text-sm text-zinc-500">MP4, MKV, AVI, MP3, WAV, M4A (Max 50MB)</p>
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-400">Source Language</label>
                  <select 
                    value={sourceLang}
                    onChange={(e) => setSourceLang(e.target.value)}
                    className="w-full bg-zinc-800 border-zinc-700 rounded-lg p-2 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                  >
                    <option value="en">English</option>
                    <option value="hi">Hindi</option>
                    <option value="ar">Arabic</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-400">Target Language</label>
                  <div className="w-full bg-zinc-800 border-zinc-700 rounded-lg p-2 text-sm flex items-center justify-between">
                    <span>Bangla (Bengali)</span>
                    <Badge variant="outline" className="text-orange-500 border-orange-500/30">Default</Badge>
                  </div>
                </div>
              </div>

              {status !== 'idle' && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">
                      {status === 'uploading' ? 'Uploading file...' : 
                       status === 'processing' ? 'AI is translating and dubbing...' : 
                       status === 'completed' ? 'Translation complete!' : 'Error occurred'}
                    </span>
                    <span className="font-mono">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2 bg-zinc-800" indicatorClassName="bg-orange-500" />
                </div>
              )}
            </CardContent>
            <CardFooter className="border-t border-zinc-800 pt-6">
              {!user ? (
                <Button onClick={handleLogin} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white h-12 rounded-xl">
                  Login to Start Translation
                </Button>
              ) : (
                <Button 
                  onClick={startTranslation} 
                  disabled={!file || status === 'uploading' || status === 'processing'}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold h-12 rounded-xl transition-all"
                >
                  {status === 'processing' ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5 mr-2" />
                      Start Translation
                    </>
                  )}
                </Button>
              )}
            </CardFooter>
          </Card>

          {/* Features & Info Section */}
          <div className="space-y-6">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-lg">Recent Jobs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ScrollArea className="h-[200px]">
                  {jobs.length === 0 ? (
                    <p className="text-sm text-zinc-500 text-center py-4">No recent jobs</p>
                  ) : (
                    <div className="space-y-2">
                      {jobs.map((job) => (
                        <div key={job.id} className="p-2 rounded bg-zinc-800/50 border border-zinc-800 flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium truncate">{job.fileName}</p>
                            <p className="text-[10px] text-zinc-500">{job.status}</p>
                          </div>
                          <Badge variant="outline" className="text-[10px] ml-2">
                            {job.progress}%
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/50 border-zinc-800 overflow-hidden">
              <div className="bg-orange-500/10 p-4 border-b border-orange-500/20">
                <div className="flex items-center gap-2 text-orange-500 font-semibold">
                  <AlertCircle className="w-4 h-4" />
                  AI Processing Info
                </div>
              </div>
              <CardContent className="p-4 text-sm text-zinc-400 space-y-4">
                <p>We use <span className="text-zinc-200">OpenAI Whisper v3</span> for high-accuracy transcription and <span className="text-zinc-200">Google Gemini</span> for semantic translation.</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                    <span>Contextual Bangla translation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                    <span>Natural AI voice dubbing</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                    <span>Auto-sync subtitles</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>

        {/* Results Section (Visible when completed) */}
        <AnimatePresence>
          {status === 'completed' && (
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Translation Results</h2>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="bg-zinc-900 border-zinc-800">
                    <Download className="w-4 h-4 mr-2" />
                    Download Video
                  </Button>
                  <Button variant="outline" size="sm" className="bg-zinc-900 border-zinc-800">
                    <Download className="w-4 h-4 mr-2" />
                    Download SRT
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="bg-zinc-900 border-zinc-800 overflow-hidden">
                  <CardHeader className="p-4 border-b border-zinc-800">
                    <CardTitle className="text-sm font-medium">Original Preview</CardTitle>
                  </CardHeader>
                  <div className="aspect-video bg-black flex items-center justify-center relative group">
                    <Play className="w-12 h-12 text-white/50 group-hover:text-white transition-all cursor-pointer" />
                    <div className="absolute bottom-4 left-4 right-4 h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="w-1/3 h-full bg-orange-500" />
                    </div>
                  </div>
                </Card>

                <Card className="bg-zinc-900 border-zinc-800 overflow-hidden">
                  <CardHeader className="p-4 border-b border-zinc-800">
                    <CardTitle className="text-sm font-medium">Translated Preview (Bangla)</CardTitle>
                  </CardHeader>
                  <div className="aspect-video bg-black flex items-center justify-center relative group">
                    <Play className="w-12 h-12 text-white/50 group-hover:text-white transition-all cursor-pointer" />
                    <div className="absolute bottom-12 left-0 right-0 text-center px-4">
                      <span className="bg-black/80 px-3 py-1 rounded text-sm text-white">
                        এই ভিডিওটি এখন বাংলায় অনুবাদ করা হয়েছে।
                      </span>
                    </div>
                    <div className="absolute bottom-4 left-4 right-4 h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="w-1/3 h-full bg-orange-500" />
                    </div>
                  </div>
                </Card>
              </div>

              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-lg">Edit Transcript</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px] w-full rounded-md border border-zinc-800 p-4">
                    <div className="space-y-4">
                      {[
                        { time: '00:00:01', text: 'স্বাগতম আমাদের নতুন ভিডিওতে।' },
                        { time: '00:00:05', text: 'আজ আমরা কথা বলব কৃত্রিম বুদ্ধিমত্তা নিয়ে।' },
                        { time: '00:00:10', text: 'এটি আমাদের জীবনকে কীভাবে পরিবর্তন করছে তা দেখুন।' }
                      ].map((item, i) => (
                        <div key={i} className="flex gap-4 group">
                          <span className="text-xs font-mono text-zinc-500 pt-1">{item.time}</span>
                          <div className="flex-1">
                            <input 
                              defaultValue={item.text}
                              className="w-full bg-transparent border-none focus:ring-0 text-zinc-200 p-0 hover:bg-zinc-800/50 rounded px-1 transition-all"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
