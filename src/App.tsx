import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Bird, Plus, Trash2, Brain, Loader2, List, Search, CheckCircle, Ban, MapPin, Trophy, Flame, Music, Volume2 
} from 'lucide-react';

export default function App() {
  // --- App State ---
  const [birds, setBirds] = useState<any[]>(() => {
    try {
      const savedBirds = localStorage.getItem('birdQuizList');
      return savedBirds ? JSON.parse(savedBirds) : [];
    } catch (e) {
      console.error("Failed to parse birds from localStorage", e);
      return [];
    }
  });

  // Track the name of the currently active list
  const [currentListName, setCurrentListName] = useState<string>(() => {
    return localStorage.getItem('birdQuizCurrentListName') || 'My List';
  });
  
  const [appState, setAppState] = useState('manage'); // 'manage', 'photoQuiz', 'soundQuiz'
  const [error, setError] = useState<string | null>(null);

  // --- Saved Locations State ---
  const [savedLocations, setSavedLocations] = useState<{ name: string; birds: any[]; highScore: number }[]>(() => {
    try {
      const saved = localStorage.getItem("birdQuizLocations");
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map((loc: any) => ({ ...loc, highScore: loc.highScore || 0 }));
      }
    } catch (e) {
      console.error("Failed to parse locations from localStorage", e);
    }
    return [];
  });

  // --- Search State ---
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState({ current: 0, total: 0 });
  const [isAdding, setIsAdding] = useState<number | null>(null);

  // --- Quiz State ---
  const [quizQuestion, setQuizQuestion] = useState<any>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [currentStreak, setCurrentStreak] = useState(0); // Streak Counter
  
  // --- Sound Quiz Specific State ---
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // --- Random Bird Widget State ---
  const [randomBird, setRandomBird] = useState<any>(null);

  // --- EFFECTS ---

  // 1. Save 'birds' list changes
  useEffect(() => {
    localStorage.setItem('birdQuizList', JSON.stringify(birds));
  }, [birds]);

  // 2. Save 'savedLocations' changes
  useEffect(() => {
    localStorage.setItem("birdQuizLocations", JSON.stringify(savedLocations));
  }, [savedLocations]);

  // 3. Save 'currentListName' changes
  useEffect(() => {
    localStorage.setItem('birdQuizCurrentListName', currentListName);
  }, [currentListName]);

  // 4. Fetch Random Bird (Strictly Birds)
  useEffect(() => {
    const fetchRandomBird = async () => {
      try {
        // taxon_id=3 is strictly Class Aves (Birds)
        const randomPage = Math.floor(Math.random() * 1000) + 1;
        const response = await fetch(
          `https://api.inaturalist.org/v1/taxa?taxon_id=3&rank=species&per_page=1&page=${randomPage}&photos=true&order_by=observations_count`
        );
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          setRandomBird(data.results[0]);
        }
      } catch (e) {
        console.error("Failed to fetch random bird", e);
      }
    };
    fetchRandomBird();
  }, []);

  // --- UTILITY FUNCTIONS ---
  const shuffleArray = (array: any[]) => {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
      [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
  };
   
  const getLastName = (name: string) => {
    if (!name) return '';
    const parts = name.split(' ');
    return parts[parts.length - 1];
  };

  // --- API & LIST FUNCTIONS ---
  
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const birdNames = searchQuery.split('\n').filter(name => name.trim() !== '');
    if (birdNames.length === 0) return;

    setIsSearching(true);
    setSearchResults([]);
    setError(null);
    setSearchProgress({ current: 0, total: birdNames.length });

    const fetchBird = async (name: string, retryCount = 0): Promise<any> => {
      try {
        const response = await fetch(`https://api.inaturalist.org/v1/taxa/autocomplete?q=${encodeURIComponent(name.trim())}&taxon_id=3`);
        
        if (!response.ok) {
           if (retryCount < 3) {
             await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)));
             return fetchBird(name, retryCount + 1);
           }
           throw new Error(`API failed for ${name}`);
        }

        const data = await response.json();
        const topHit = data.results.find(
          (r: any) => r.rank === 'species' && 
          r.default_photo &&
          (r.name.toLowerCase() === name.trim().toLowerCase() || 
           r.preferred_common_name?.toLowerCase() === name.trim().toLowerCase())
        );
        return topHit || data.results.find((r: any) => r.rank === 'species' && r.default_photo);
      } catch (err) {
        console.error(`Failed to search for ${name}:`, err);
        return null;
      }
    };

    const BATCH_SIZE = 3;
    
    for (let i = 0; i < birdNames.length; i += BATCH_SIZE) {
      const batch = birdNames.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(name => fetchBird(name));
      const batchResults = await Promise.allSettled(batchPromises);
      
      const successfulBatch = batchResults
        .filter((res): res is PromiseFulfilledResult<any> => res.status === 'fulfilled')
        .filter(res => res.value)
        .map(res => res.value);
        
      setSearchResults(prev => [...prev, ...successfulBatch]);
      setSearchProgress(prev => ({ ...prev, current: Math.min(i + BATCH_SIZE, birdNames.length) }));
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setIsSearching(false);
  };

  const handleAddBird = (iNatResult: any) => {
    setError(null);
    if (birds.some((b) => b.id === iNatResult.id)) {
      setError(`${iNatResult.preferred_common_name || iNatResult.name} is already in your list.`);
      return;
    }
    setBirds(prevBirds => {
      const newList = [...prevBirds, iNatResult];
      newList.sort((a, b) => (a.preferred_common_name || a.name).localeCompare(b.preferred_common_name || b.name));
      return newList;
    });
    setSearchResults(prevResults => prevResults.filter(r => r.id !== iNatResult.id));
  };

  const handleAddAllResults = () => {
    const newBirds = searchResults.filter(result => !birds.some(b => b.id === result.id));

    if (newBirds.length === 0) {
      setError("All birds in search results are already in your list.");
      return;
    }

    setBirds(prev => {
      const updated = [...prev, ...newBirds];
      updated.sort((a, b) => (a.preferred_common_name || a.name).localeCompare(b.preferred_common_name || b.name));
      return updated;
    });

    setSearchResults([]);
  };

  const handleDeleteBird = (birdId: any) => {
    setBirds(prevBirds => prevBirds.filter(b => b.id !== birdId));
  };

  const handleRemoveSearchResult = (id: number) => {
    setSearchResults(prev => prev.filter(r => r.id !== id));
  };

  const handleClearList = () => {
    if (birds.length === 0) return;
    if (window.confirm("Are you sure you want to REMOVE ALL birds from your current list? This cannot be undone.")) {
      setBirds([]);
      setCurrentListName("My List"); 
      setCurrentStreak(0);
    }
  };

  // --- LOCATION MANAGER FUNCTIONS ---

  const handleSaveList = (locationName: string) => {
    const trimmedName = locationName.trim();
    if (!trimmedName) {
      setError("Location name cannot be empty.");
      return;
    }
    if (birds.length === 0) {
      setError("Cannot save an empty list. Please add birds first.");
      return;
    }
    if (savedLocations.some(loc => loc.name.toLowerCase() === trimmedName.toLowerCase())) {
      setError(`A location named "${trimmedName}" already exists.`);
      return;
    }

    const newLocation = { name: trimmedName, birds: [...birds], highScore: currentStreak };
    setSavedLocations(prev => [...prev, newLocation].sort((a, b) => a.name.localeCompare(b.name)));
    setBirds([]);
    setSearchQuery('');
    setCurrentListName(trimmedName); 
    setCurrentStreak(0);
  };

  const handleLoadList = (locationName: string) => {
    const location = savedLocations.find(loc => loc.name === locationName);
    if (location) {
      setBirds([...location.birds]);
      setCurrentListName(locationName);
      setCurrentStreak(0);
      setAppState('manage');
    }
  };

  const handleDeleteList = (locationName: string) => {
    if (window.confirm(`Are you sure you want to delete the list for "${locationName}"?`)) {
      setSavedLocations(prev => prev.filter(loc => loc.name !== locationName));
      if (currentListName === locationName) setCurrentListName("My List");
    }
  };

  // --- QUIZ LOGIC ---
  const generateQuizQuestion = useCallback((type: 'photo' | 'sound') => {
    if (birds.length < 2) {
      setError("You need at least 2 birds to start a quiz.");
      setAppState('manage');
      return;
    }
    setSelectedAnswer(null);
    setFeedback(null);
    setAudioUrl(null);

    const correctBird = birds[Math.floor(Math.random() * birds.length)];
    const correctName = correctBird.preferred_common_name || correctBird.name;
    const correctLastName = getLastName(correctName);

    const otherBirds = birds.filter(b => b.id !== correctBird.id);

    const smartMatches = otherBirds.filter(b => {
      const name = b.preferred_common_name || b.name;
      return getLastName(name) === correctLastName;
    });

    const randomMatches = otherBirds.filter(b => {
      const name = b.preferred_common_name || b.name;
      return getLastName(name) !== correctLastName;
    });
    
    const shuffledSmart = shuffleArray(smartMatches);
    const shuffledRandom = shuffleArray(randomMatches);
    
    const wrongAnswers = [];
    const numOptions = Math.min(3, otherBirds.length);

    const smartToAdd = shuffledSmart.slice(0, numOptions);
    wrongAnswers.push(...smartToAdd);

    const randomNeeded = numOptions - wrongAnswers.length;
    if (randomNeeded > 0) {
      const randomToAdd = shuffledRandom.slice(0, randomNeeded);
      wrongAnswers.push(...randomToAdd);
    }
    
    const options = wrongAnswers.map(b => b.preferred_common_name || b.name);
    options.push(correctName);
    const finalOptions = shuffleArray(options);

    setQuizQuestion({
      bird: {
        name: correctName,
        url: correctBird.default_photo?.medium_url
      },
      options: finalOptions
    });

    // --- FRONTEND PROXY AUDIO LOGIC (SWITCHED TO ALLORIGINS) ---
    if (type === 'sound') {
      setIsAudioLoading(true);
      
      // Use AllOrigins to bypass security blocks
      const proxyUrl = "https://api.allorigins.win/raw?url=";
      // Query Xeno-Canto by Scientific Name (more accurate) or Common Name
      const xenoUrl = `https://www.xeno-canto.org/api/2/recordings?query=${encodeURIComponent(correctBird.name)}`;
      
      fetch(proxyUrl + encodeURIComponent(xenoUrl))
        .then(res => res.json())
        .then(data => {
           let recs = data.recordings || [];
           
           // Filter for A/B/C quality to filter out terrible ones, but keep enough to be useful
           // 'A' = High, 'B' = Good, 'C' = Average
           let best = recs.filter((r: any) => ['A', 'B', 'C'].includes(r.q));
           
           if (best.length === 0) best = recs; // Fallback to anything if no quality ratings

           if (best.length > 0) {
             // FORCE HTTPS
             let fileUrl = best[0].file;
             if (fileUrl.startsWith('http://')) {
               fileUrl = fileUrl.replace('http://', 'https://');
             }
             setAudioUrl(fileUrl);
           } else {
             // No recordings found
           }
        })
        .catch(err => console.error("Error fetching sound:", err))
        .finally(() => setIsAudioLoading(false));
    }
  }, [birds]);

  const startPhotoQuiz = () => {
    if (birds.length < 2) return;
    setError(null);
    setAppState('photoQuiz');
    generateQuizQuestion('photo');
  };

  const startSoundQuiz = () => {
    if (birds.length < 2) return;
    setError(null);
    setAppState('soundQuiz');
    generateQuizQuestion('sound');
  };

  const handleAnswerSelect = (optionName: string) => {
    if (feedback) return;
    setSelectedAnswer(optionName);
    
    const isCorrect = optionName === quizQuestion.bird.name;
    
    if (isCorrect) {
      setFeedback('correct');
      const newStreak = currentStreak + 1;
      setCurrentStreak(newStreak);

      if (currentListName !== "My List") {
        setSavedLocations(prev => prev.map(loc => {
          if (loc.name === currentListName) {
            return { ...loc, highScore: Math.max(loc.highScore, newStreak) };
          }
          return loc;
        }));
      }
    } else {
      setFeedback('incorrect');
      setCurrentStreak(0);
    }
  };

  // --- RENDER FUNCTIONS ---

  const renderLoading = (text = "Loading...") => (
    <div className="flex flex-col items-center justify-center h-full text-gray-500 py-8">
      <Loader2 className="h-12 w-12 animate-spin" />
      <p className="mt-4 text-lg">{text}</p>
    </div>
  );

  const renderManageBirds = () => (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
     
      <div className="flex flex-col md:flex-row gap-6">
        
        {/* === COLUMN 1: Search Section (Wider Column) === */}
        <div className="w-full md:w-2/3">
                    
          <form onSubmit={handleSearch} className="mb-6 p-4 bg-gray-50 rounded-lg shadow-md">
            {/* PRESERVED CUSTOM TEXT: */}
            <p className="text-sm text-gray-600 mb-3"><span className="font-bold text-blue-600">Quiz My Lifers</span> lets you create photo lists of birds, so you can take quizzes and get better at identifying them. Type or paste (long) lists of bird names, add them to your list and take the quiz as many times as you want. <span className="italic">Bonus feature: save your list as a location.</span></p>
            <div className="flex flex-col space-y-3">
              <textarea
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Sokoke Pipit&#10;Amani Sunbird&#10;Fischer's Turaco..."
                className="p-2 border rounded-md focus:ring-2 focus:ring-blue-500 flex-1 font-mono text-sm"
                rows={10}
              />
              <button
                type="submit"
                disabled={isSearching}
                className="flex items-center justify-center py-2 px-4 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isSearching ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                <span className="ml-2">Search for {searchQuery.split('\n').filter(Boolean).length || 0} birds</span>
              </button>
            </div>
          </form>

          {/* Search Progress Bar & Results */}
          {isSearching && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex justify-between text-sm font-semibold text-blue-700 mb-2">
                 <div className="flex items-center">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    <span>Searching iNaturalist...</span>
                 </div>
                 <span>{searchProgress.current} / {searchProgress.total} birds checked</span>
              </div>
              {/* The Blue Bar */}
              <div className="w-full bg-blue-200 rounded-full h-2.5">
                 <div 
                   className="bg-blue-600 h-2.5 rounded-full transition-all duration-500 ease-out" 
                   style={{ width: `${(searchProgress.current / searchProgress.total) * 100}%` }}
                 ></div>
              </div>
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="mb-6">
              {/* ADD ALL BUTTON */}
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xl font-semibold">Search Results ({searchResults.length})</h3>
                <button 
                  onClick={handleAddAllResults}
                  className="flex items-center px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-semibold shadow-sm"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add All ({searchResults.length})
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-3">Click '+' to add, or 'Trash' to remove incorrect matches.</p>
              <div className="space-y-3">
                {searchResults.map((result) => (
                  <div key={result.id} className="bg-white p-3 rounded-lg shadow-md flex items-center space-x-3">
                    <img
                      src={result.default_photo?.medium_url}
                      alt={result.preferred_common_name || result.name}
                      referrerPolicy="no-referrer"
                      className="h-16 w-16 rounded-md object-cover bg-gray-200 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 truncate">{result.preferred_common_name || result.name}</p>
                      <p className="text-sm text-gray-500 italic truncate">{result.name}</p>
                    </div>
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleRemoveSearchResult(result.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                        title="Remove this result"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleAddBird(result)}
                        disabled={isAdding === result.id || birds.some((b: any) => b.id === result.id)}
                        className="p-2 bg-green-500 text-white rounded-md font-semibold hover:bg-green-600 transition-colors disabled:opacity-50 flex-shrink-0"
                        title={`Add ${result.preferred_common_name || result.name}`}
                      >
                        {isAdding === result.id ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          birds.some((b: any) => b.id === result.id) ? <CheckCircle className="h-5 w-5" /> : <Plus className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* === COLUMN 2: Random Bird & Location Manager (Narrower Column) === */}
        <div className="w-full md:w-1/3 space-y-6">
          
          {/* --- Random Bird Widget --- */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
             {randomBird ? (
               <>
                 <div className="relative h-48 w-full bg-gray-100">
                   <img 
                     src={randomBird.default_photo?.medium_url} 
                     alt={randomBird.name}
                     className="w-full h-full object-cover"
                   />
                   <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8">
                     <p className="text-white font-bold truncate">{randomBird.preferred_common_name || randomBird.name}</p>
                     <p className="text-white/80 text-xs italic">{randomBird.name}</p>
                   </div>
                 </div>
                 <div className="p-4 bg-gray-50 text-xs text-gray-600">
                    <div className="flex items-center mb-2">
                      <img src="https://static.inaturalist.org/sites/1-favicon.png" alt="iNaturalist" className="h-4 w-4 mr-2" />
                      <span>Bird images provided by iNaturalist.</span>
                    </div>
                    <p className="mb-2">
                      Accessed {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.
                    </p>
                    <a 
                      href="https://www.inaturalist.org/donate" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-semibold block mb-3"
                    >
                      Consider donating to iNaturalist.
                    </a>
                    
                    {/* Footer Section */}
                    <div className="border-t border-gray-200 pt-2 mt-2 text-gray-500">
                      &copy; Tachymarptis 2025. <a href="mailto:roerig@gmail.com?subject=Quiz My Lifers" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 hover:underline">Contact</a>.
                    </div>
                 </div>
               </>
             ) : (
               <div className="h-48 flex items-center justify-center text-gray-400">
                 <Loader2 className="h-8 w-8 animate-spin" />
               </div>
             )}
          </div>

          {/* --- Saved Locations Manager --- */}
          <div className="p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded-lg shadow-md sticky top-4">
            <h3 className="text-xl font-bold text-yellow-800 mb-4 flex items-center">
              <Brain className="h-5 w-5 mr-2" />
              Location List Manager ({savedLocations.length})
            </h3>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              const input = e.currentTarget.elements.namedItem("locationName") as HTMLInputElement;
              if (input) handleSaveList(input.value);
            }} className="flex flex-col gap-2 mb-4">
              <input
                type="text"
                id="locationName"
                name="locationName"
                placeholder="e.g., Arabuko Sokoke"
                required
                className="p-2 border rounded-md flex-1 focus:ring-2 focus:ring-yellow-500 min-w-0"
              />
              <button
                type="submit"
                disabled={birds.length === 0}
                className="py-1 px-3 bg-yellow-600 text-white rounded-md font-semibold hover:bg-yellow-700 transition-colors disabled:opacity-50 flex-shrink-0 flex items-center justify-center"
              >
                <Plus className="h-5 w-5 mr-1" />
                Save Current List ({birds.length})
              </button>
            </form>

            {savedLocations.length > 0 && (
              <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
                <p className="text-sm font-semibold text-yellow-700 sticky top-0 bg-yellow-50 z-10 p-1 -m-1 border-b border-yellow-200">Saved Locations:</p>
                {savedLocations.map((loc) => (
                  <div key={loc.name} className="flex items-center justify-between p-2 bg-white rounded-md border shadow-sm">
                    <div className="flex-1 min-w-0 mr-2">
                      <p className="font-medium text-gray-800 truncate">{loc.name}</p>
                      <p className="text-xs text-gray-500 flex items-center">
                        <span>{loc.birds.length} birds</span>
                        <span className="mx-1">•</span>
                        <Trophy className="h-3 w-3 text-yellow-600 mr-1" />
                        <span className="font-semibold text-yellow-700">{loc.highScore || 0}</span>
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleLoadList(loc.name)}
                        className="p-1 px-3 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => handleDeleteList(loc.name)}
                        className="p-1 text-red-500 hover:text-white hover:bg-red-500 rounded-full transition-colors"
                        title={`Delete ${loc.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {savedLocations.length === 0 && (
              <p className="text-gray-500 text-sm">No locations saved yet. Save your current bird list above!</p>
            )}
          </div>
        </div>
      </div>
      
      {/* --- Current List Section --- */}
      <div className="mt-8 border-t pt-8">
        <div className="flex justify-between items-center mb-4">
           <h3 className="text-xl font-semibold text-gray-800">Your Current List ({birds.length})</h3>
           
           {birds.length > 0 && (
             <button
               onClick={handleClearList}
               className="flex items-center px-3 py-1.5 bg-red-100 text-red-600 rounded-md hover:bg-red-200 transition-colors text-sm font-semibold"
             >
               <Trash2 className="h-4 w-4 mr-1" />
               Clear List
             </button>
           )}
        </div>

        {birds.length === 0 && !isSearching && (
          <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
            <Bird className="h-12 w-12 mx-auto text-gray-300 mb-2" />
            <p className="text-gray-500">Your quiz list is empty.</p>
            <p className="text-gray-400 text-sm">Add birds from the Search section above or load a saved list.</p>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {birds.map((bird) => (
            <div key={bird.id} className="bg-white p-3 rounded-lg shadow-md flex items-center space-x-3">
              <img
                src={bird.default_photo?.medium_url}
                alt={bird.preferred_common_name || bird.name}
                referrerPolicy="no-referrer"
                className="h-16 w-16 rounded-md object-cover bg-gray-200"
              />
              <p className="flex-1 font-medium text-gray-700 truncate">{bird.preferred_common_name || bird.name}</p>
              <button
                onClick={() => handleDeleteBird(bird.id)}
                className="p-2 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-full transition-colors flex-shrink-0"
                title={`Delete ${bird.preferred_common_name || bird.name}`}
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          ))}
        </div>
      </div>
      
      <div className="grid grid-cols-1 mt-6">
        <button
          onClick={startPhotoQuiz}
          disabled={birds.length < 2}
          className="w-full flex items-center justify-center p-4 bg-green-600 text-white rounded-lg font-bold text-xl hover:bg-green-700 transition-all shadow-lg disabled:opacity-50 disabled:shadow-none"
        >
          <Brain className="h-8 w-8 mr-3" />
          Quiz me now!
        </button>
      </div>
    </div>
  );

  const renderQuizContent = (type: 'photo' | 'sound') => {
    if (!quizQuestion) return renderLoading();
    const { bird, options } = quizQuestion;
    const currentLoc = savedLocations.find(l => l.name === currentListName);
    const record = currentLoc ? currentLoc.highScore : 0;

    return (
      <div className="p-4 md:p-8 max-w-6xl mx-auto">
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
          {type === 'photo' ? "Which bird is this?" : "Who is making this sound?"}
        </h2>
        
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          
          <div className="w-full lg:w-3/5 h-[400px] lg:h-[600px] bg-gray-200 rounded-lg shadow-lg overflow-hidden flex flex-col items-center justify-center relative">
            
            {type === 'photo' ? (
               /* PHOTO MODE */
               bird.url ? (
                <img src={bird.url} alt="Bird" className="w-full h-full object-contain" />
              ) : (
                <div className="flex flex-col items-center text-gray-500"><Ban className="h-16 w-16"/><p>No image</p></div>
              )
            ) : (
               /* SOUND MODE */
               <div className="flex flex-col items-center justify-center w-full h-full bg-gray-800 text-white p-6 text-center">
                 {/* Show Photo ONLY if answered correctly */}
                 {feedback === 'correct' ? (
                    <img src={bird.url} alt="Bird" className="absolute inset-0 w-full h-full object-contain bg-gray-200 animate-in fade-in duration-700" />
                 ) : (
                    <Music className="h-32 w-32 mb-6 text-purple-400 animate-pulse" />
                 )}

                 <div className="z-10 bg-white/90 p-4 rounded-xl shadow-xl w-full max-w-md backdrop-blur-sm text-gray-800">
                    {isAudioLoading ? (
                      <div className="flex items-center justify-center text-gray-600"><Loader2 className="h-6 w-6 animate-spin mr-2"/>Loading Sound...</div>
                    ) : audioUrl ? (
                      <audio ref={audioRef} controls autoPlay className="w-full" src={audioUrl} />
                    ) : (
                       <div className="text-red-500 font-semibold">Sound not available for this bird.</div>
                    )}
                 </div>
               </div>
            )}
          </div>
          
          <div className="w-full lg:w-2/5 flex flex-col space-y-4">
            <div className="flex justify-between mb-2 px-2">
               <div className="flex items-center text-orange-500 font-bold text-lg" key={currentStreak}>
                  <Flame className="h-6 w-6 mr-1 fill-orange-500" /> {currentStreak}
               </div>
               <div className="flex items-center text-yellow-600 font-bold text-lg">
                  <Trophy className="h-6 w-6 mr-1 fill-yellow-500" /> {record}
               </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {options.map((option: string) => {
                const isCorrect = option === bird.name;
                const isSelected = option === selectedAnswer;
                let buttonClass = "p-4 rounded-md text-left font-medium text-lg transition-all shadow-sm border-2 ";
                
                if (feedback) {
                  if (isCorrect) buttonClass += "bg-green-500 text-white border-green-600";
                  else if (isSelected) buttonClass += "bg-red-500 text-white border-red-600";
                  else buttonClass += "bg-gray-100 text-gray-400 border-gray-200 opacity-50";
                } else {
                  buttonClass += "bg-white hover:bg-blue-50 text-gray-800 border-gray-200 hover:border-blue-500 cursor-pointer";
                }
                return (
                  <button key={option} onClick={() => handleAnswerSelect(option)} disabled={!!feedback} className={buttonClass}>
                    {option}
                  </button>
                );
              })}
            </div>
            
            {feedback && (
              <div className="mt-4 p-6 bg-white rounded-lg shadow-md border-2 border-gray-100 animate-in fade-in slide-in-from-top-4">
                {feedback === 'correct' ? (
                  <div className="flex items-center justify-center text-green-600 mb-2">
                    <CheckCircle className="h-8 w-8 mr-2" />
                    <h3 className="text-2xl font-bold">Correct!</h3>
                  </div>
                ) : (
                  <div className="flex items-center justify-center text-red-600 mb-2">
                    <Ban className="h-8 w-8 mr-2" />
                    <h3 className="text-2xl font-bold">Incorrect</h3>
                  </div>
                )}
                <p className="text-center text-gray-600 mb-4">It was a <span className="font-bold">{bird.name}</span></p>
                <button
                  onClick={() => generateQuizQuestion(type)}
                  className="w-full p-4 bg-blue-600 text-white rounded-lg font-bold text-xl hover:bg-blue-700 transition-colors shadow-lg"
                >
                  Next Question
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (appState === 'photoQuiz') {
      return renderQuizContent('photo');
    }
    if (appState === 'soundQuiz') {
      return renderQuizContent('sound');
    }
    return renderManageBirds();
  };
  
  return (
    <div className="w-full h-screen bg-gray-100 font-inter antialiased">
      <header className="bg-white shadow-md">
        <div className="container mx-auto px-4 py-4 flex flex-wrap justify-between items-center">
          <button onClick={() => { setFeedback(null); setAppState('manage'); }} className="flex items-center space-x-2 mb-2 sm:mb-0 hover:opacity-75 transition-opacity">
            <Bird className="h-8 w-8 text-blue-600" />
            <h1 className="text-xl md:text-2xl font-bold text-gray-800">Quiz My Lifers</h1>
          </button>

          <div className="flex space-x-2 items-center">
            <div className="flex items-center mr-2 sm:mr-4 text-blue-800 bg-blue-50 px-3 py-1 rounded-full border border-blue-200 text-sm font-medium whitespace-nowrap max-w-[150px] sm:max-w-[200px] overflow-hidden text-ellipsis">
              <MapPin className="h-4 w-4 mr-1 flex-shrink-0" />
              <span className="truncate">{currentListName}</span>
            </div>

            <button onClick={startPhotoQuiz} disabled={appState === 'photoQuiz' || birds.length < 2} className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50">
              <Brain className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Photo Quiz</span>
            </button>

            <button onClick={startSoundQuiz} disabled={appState === 'soundQuiz' || birds.length < 2} className="flex items-center px-3 py-2 bg-purple-600 text-white rounded-md font-semibold hover:bg-purple-700 transition-colors shadow-sm disabled:opacity-50">
              <Volume2 className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Sound Quiz</span>
            </button>
          </div>
        </div>
      </header>
      
      {error && (
        <div className={`p-4 m-4 rounded-md border-l-4 transition-colors bg-red-100 border-red-500 text-red-700`} role="alert">
          <p className="font-bold">Error</p>
          <p>{error}</p>
          <button onClick={() => setError(null)} className={`mt-2 text-sm font-semibold text-red-600`}>Dismiss</button>
        </div>
      )}

      <main className="container mx-auto px-4 py-6 h-[calc(100vh-80px)] overflow-y-auto">
        {renderContent()}
      </main>
    </div>
  );
}