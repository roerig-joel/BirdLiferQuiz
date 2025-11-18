import React, { useState, useEffect, useCallback } from "react";
import {
  Bird,
  Plus,
  Trash2,
  Brain,
  X,
  Loader2,
  List,
  Search,
  CheckCircle,
  Ban,
} from "lucide-react";

// --- App Component ---
export default function App() {
  // App State
  // v-- MODIFIED: Read from localStorage on initial load --v
  const [birds, setBirds] = useState<any[]>(() => {
    try {
      const savedBirds = localStorage.getItem("birdQuizList");
      return savedBirds ? JSON.parse(savedBirds) : [];
    } catch (e) {
      console.error("Failed to parse birds from localStorage", e);
      return [];
    }
  }); // <-- MODIFIED
  // ^-- This is a "lazy initializer" for useState --^

  const [appState, setAppState] = useState("manage"); // 'manage', 'photoQuiz'
  const [error, setError] = useState<string | null>(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(null);

  // Quiz State
  const [quizQuestion, setQuizQuestion] = useState<any>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
const [quizQuestion, setQuizQuestion] = useState<any>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
// --- Saved Locations State & Logic ---

/*
 * FEATURE: MULTI-LIST MANAGEMENT
 * GOAL: Create a robust system for saving, loading, and managing multiple named bird lists.
 * * 1. Define new state: `savedLocations` initialized from localStorage (key: 'birdQuizLocations').
 * The state structure should be an array of objects: { name: string, birds: any[] }.
 * 2. Implement persistence: Use a useEffect hook to save `savedLocations` to localStorage anytime it changes.
 * 3. Implement a function `handleSaveList(locationName: string)` that:
 * a) Checks if the name already exists.
 * b) If current 'birds' list is empty, display an error.
 * c) Saves the current 'birds' list into a new location object in `savedLocations`.
 * d) Clears the current 'birds' list and the 'searchQuery'.
 * 4. Implement a function `handleLoadList(locationName: string)` that:
 * a) Finds the list by name in `savedLocations`.
 * b) Sets the current `birds` state to the selected list's birds.
 * 5. Implement a function `handleDeleteList(locationName: string)` to remove a list from `savedLocations`.
 */

// Copilot: Begin generating the state and functions below:
// --- Code generated manually to bypass Copilot bug ---
const [savedLocations, setSavedLocations] = useState<{ name: string; birds: any[] }[]>(() => {
  try {
    const saved = localStorage.getItem("birdQuizLocations");
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error("Failed to parse locations from localStorage", e);
  }
  return [];
});

// NEW: useEffect to save the master list of locations
useEffect(() => {
  localStorage.setItem("birdQuizLocations", JSON.stringify(savedLocations));
}, [savedLocations]);


// OLD: Original useEffect to save the current 'birds' list
useEffect(() => {
  localStorage.setItem("birdQuizList", JSON.stringify(birds));
}, [birds]);


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

  // Create new location object
  const newLocation = { name: trimmedName, birds: [...birds] };
  setSavedLocations(prev => [...prev, newLocation].sort((a, b) => a.name.localeCompare(b.name)));
  
  // Clears the current 'birds' list and the 'searchQuery'.
  setBirds([]);
  setSearchQuery('');
  setError(`List "${trimmedName}" saved successfully! Your current list is now empty.`);
};

const handleLoadList = (locationName: string) => {
  const location = savedLocations.find(loc => loc.name === locationName);
  if (location) {
    setBirds([...location.birds]);
    setAppState('manage');
    setError(`List "${locationName}" loaded. (${location.birds.length} birds)`);
  }
};

const handleDeleteList = (locationName: string) => {
  if (window.confirm(`Are you sure you want to delete the list for "${locationName}"?`)) {
    setSavedLocations(prev => prev.filter(loc => loc.name !== locationName));
    setError(`List "${locationName}" deleted.`);
  }
};
// --- END manually generated code ---
  // --- Utility Functions ---
  // --- NEW: Save to localStorage whenever 'birds' changes ---
  useEffect(() => {
    localStorage.setItem("birdQuizList", JSON.stringify(birds));
  }, [birds]);
  // --- END NEW ---

  // --- Utility Functions ---
  const shuffleArray = (array: any[]) => {
    // ... (rest of the function, no changes)
    let currentIndex = array.length,
      randomIndex;
    while (currentIndex !== 0) {
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex],
        array[currentIndex],
      ];
    }
    return array;
  };

  const getLastName = (name: string) => {
    // ... (rest of the function, no changes)
    if (!name) return "";
    const parts = name.split(" ");
    return parts[parts.length - 1];
  };

  // --- API Functions ---
  const handleSearch = async (e: React.FormEvent) => {
    // ... (rest of the function, no changes)
    e.preventDefault();
    const birdNames = searchQuery
      .split("\n")
      .filter((name) => name.trim() !== "");
    if (birdNames.length === 0) return;

    setIsSearching(true);
    setSearchResults([]);
    setError(null);

    const searchPromises = birdNames.map(async (name) => {
      try {
        const response = await fetch(
          `https://api.inaturalist.org/v1/taxa/autocomplete?q=${encodeURIComponent(
            name.trim()
          )}`
        );
        if (!response.ok) throw new Error(`API failed for ${name}`);
        const data = await response.json();
        // Find the best, most relevant result
        const topHit = data.results.find(
          (r: any) =>
            r.rank === "species" &&
            r.default_photo &&
            (r.name.toLowerCase() === name.trim().toLowerCase() ||
              r.preferred_common_name?.toLowerCase() ===
                name.trim().toLowerCase())
        );
        // If no exact match, take the first species with a photo
        return (
          topHit ||
          data.results.find((r: any) => r.rank === "species" && r.default_photo)
        );
      } catch (err) {
        console.error(`Failed to search for ${name}:`, err);
        return null; // Return null on failure for this specific bird
      }
    });

    try {
      const results = await Promise.allSettled(searchPromises);
      const successfulResults = results
        .filter(
          (res): res is PromiseFulfilledResult<any> =>
            res.status === "fulfilled"
        )
        .filter((res) => res.value)
        .map((res) => res.value);

      setSearchResults(successfulResults);
      if (successfulResults.length === 0) {
        setError(
          "No valid bird species found. Check your spelling or try different names."
        );
      }
    } catch (batchError) {
      console.error("Batch search error:", batchError);
      setError("An error occurred during the search. Please try again.");
    }

    setIsSearching(false);
  };

  const handleAddBird = (iNatResult: any) => {
    // ... (rest of the function, no changes)
    setError(null);

    // Check for duplicates
    if (birds.some((b: any) => b.id === iNatResult.id)) {
      setError(
        `${
          iNatResult.preferred_common_name || iNatResult.name
        } is already in your list.`
      );
      return;
    }

    // Add to local state
    setBirds((prevBirds) => {
      const newList = [...prevBirds, iNatResult];
      // Sort alphabetically
      newList.sort((a, b) =>
        (a.preferred_common_name || a.name).localeCompare(
          b.preferred_common_name || b.name
        )
      );
      return newList;
    });

    // Remove from search results
    setSearchResults((prevResults) =>
      prevResults.filter((r) => r.id !== iNatResult.id)
    );
  };

  const handleDeleteBird = (birdId: any) => {
    // ... (rest of the function, no changes)
    setBirds((prevBirds) => prevBirds.filter((b) => b.id !== birdId));
  };

  // --- Photo Quiz Logic ---
  const generatePhotoQuizQuestion = useCallback(() => {
    // ... (rest of the function, no changes)
    if (birds.length < 2) {
      setError("You need at least 2 birds to start a quiz.");
      setAppState("manage");
      return;
    }
    setSelectedAnswer(null);
    setFeedback(null);

    // 1. Select correct bird
    const correctBird = birds[Math.floor(Math.random() * birds.length)];
    const correctName = correctBird.preferred_common_name || correctBird.name;
    const correctLastName = getLastName(correctName);

    // 2. Build list of potential wrong answers
    const otherBirds = birds.filter((b) => b.id !== correctBird.id);

    // 3. Find "smart" matches (same last word, e.g., "Sunbird")
    const smartMatches = otherBirds.filter((b) => {
      const name = b.preferred_common_name || b.name;
      return getLastName(name) === correctLastName;
    });

    // 4. Find "random" matches (different last word)
    const randomMatches = otherBirds.filter((b) => {
      const name = b.preferred_common_name || b.name;
      return getLastName(name) !== correctLastName;
    });

    const shuffledSmart = shuffleArray(smartMatches);
    const shuffledRandom = shuffleArray(randomMatches);

    const wrongAnswers = [];
    const numOptions = Math.min(3, otherBirds.length); // We need 3 wrong answers, or fewer if list is small

    // 5. Fill with smart matches first
    const smartToAdd = shuffledSmart.slice(0, numOptions);
    wrongAnswers.push(...smartToAdd);

    // 6. Fill the rest with random matches
    const randomNeeded = numOptions - wrongAnswers.length;
    if (randomNeeded > 0) {
      const randomToAdd = shuffledRandom.slice(0, randomNeeded);
      wrongAnswers.push(...randomToAdd);
    }

    // 7. Create final options list
    const options = wrongAnswers.map((b) => b.preferred_common_name || b.name);
    options.push(correctName);
    const finalOptions = shuffleArray(options);

    setQuizQuestion({
      bird: {
        name: correctName,
        url: correctBird.default_photo?.medium_url,
      },
      options: finalOptions,
    });
  }, [birds]);

  const startPhotoQuiz = () => {
    // ... (rest of the function, no changes)
    if (birds.length < 2) {
      setError("Please add at least 2 birds to start a photo quiz.");
      return;
    }
    setError(null);
    setAppState("photoQuiz");
    generatePhotoQuizQuestion();
  };

  const handlePhotoAnswerSelect = (optionName: string) => {
    // ... (rest of the function, no changes)
    if (feedback) return;
    setSelectedAnswer(optionName);
    if (optionName === quizQuestion.bird.name) {
      setFeedback("correct");
    } else {
      setFeedback("incorrect");
    }
  };

  // --- Render Functions ---
  // ... (All render functions remain exactly the same) ...

  const renderLoading = (text = "Loading...") => (
    <div className="flex flex-col items-center justify-center h-full text-gray-500">
      <Loader2 className="h-12 w-12 animate-spin" />
      <p className="mt-4 text-lg">{text}</p>
    </div>
  );

  const renderManageBirds = () => (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">
        Manage your species list
      </h2>
{/* --- Saved Locations Manager --- */}
      <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded-lg shadow">
        <h3 className="text-xl font-bold text-yellow-800 mb-4 flex items-center">
          <Brain className="h-5 w-5 mr-2" />
          Location List Manager ({savedLocations.length})
        </h3>
        
        {/* Save Current List Input */}
        <form onSubmit={(e) => {
          e.preventDefault();
          // Find the input field by its name/id in the form, or use a state variable if defined elsewhere.
          // Since we don't have a specific state for this input, we'll read it directly from the form.
          const input = e.currentTarget.elements.namedItem("locationName") as HTMLInputElement;
          if (input) handleSaveList(input.value);
        }} className="flex gap-2 mb-4">
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
            className="p-2 px-4 bg-yellow-600 text-white rounded-md font-semibold hover:bg-yellow-700 transition-colors disabled:opacity-50 flex-shrink-0"
          >
            <Plus className="h-5 w-5 mr-1" />
            Save Current List ({birds.length})
          </button>
        </form>

        {/* Display Saved Lists */}
        {savedLocations.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-semibold text-yellow-700">Saved Locations:</p>
            {savedLocations.map((loc) => (
              <div key={loc.name} className="flex items-center justify-between p-2 bg-white rounded-md border shadow-sm">
                <p className="font-medium text-gray-800 truncate">
                  {loc.name} <span className="text-sm text-gray-500">({loc.birds.length} birds)</span>
                </p>
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
      {/* --- END Saved Locations Manager --- */}
      {/* --- Search Section --- */}
      <form
        onSubmit={handleSearch}
        className="mb-6 p-4 bg-gray-50 rounded-lg shadow"
      >
        <h3 className="text-lg font-semibold mb-3">Add new species</h3>
        <p className="text-sm text-gray-600 mb-3">
          Paste your list of species below, one name per line.
        </p>
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
            className="flex items-center justify-center p-2 px-4 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isSearching ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Search className="h-5 w-5" />
            )}
            <span className="ml-2">
              Search for {searchQuery.split("\n").filter(Boolean).length || 0}{" "}
              species
            </span>
          </button>
        </div>
      </form>

      {/* --- Search Results Section --- */}
      {isSearching && renderLoading("Searching iNaturalist for your list...")}
      {searchResults.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-3">
            Search Results ({searchResults.length})
          </h3>
          <p className="text-sm text-gray-600 mb-3">
            Click '+' to add species to your quiz list.
          </p>
          <div className="space-y-3">
            {searchResults.map((result) => (
              <div
                key={result.id}
                className="bg-white p-3 rounded-lg shadow-md flex items-center space-x-3"
              >
                <img
                  src={result.default_photo?.medium_url}
                  alt={result.preferred_common_name || result.name}
                  referrerPolicy="no-referrer"
                  className="h-16 w-16 rounded-md object-cover bg-gray-200 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 truncate">
                    {result.preferred_common_name || result.name}
                  </p>
                  <p className="text-sm text-gray-500 italic truncate">
                    {result.name}
                  </p>
                </div>
                <button
                  onClick={() => handleAddBird(result)}
                  disabled={
                    isAdding === result.id ||
                    birds.some((b) => b.id === result.id)
                  }
                  className="p-2 bg-green-500 text-white rounded-md font-semibold hover:bg-green-600 transition-colors disabled:opacity-50 flex-shrink-0"
                  title={`Add ${result.preferred_common_name || result.name}`}
                >
                  {isAdding === result.id ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : birds.some((b) => b.id === result.id) ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <Plus className="h-5 w-5" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- Current List Section --- */}
      <div className="mb-6">
        <h3 className="text-xl font-semibold mb-3">
          Your Quiz List ({birds.length})
        </h3>
        {birds.length === 0 && !isSearching && (
          <p className="text-gray-500">
            Your quiz list is empty. Search for species above to get started!
          </p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {birds.map((bird) => (
            <div
              key={bird.id}
              className="bg-white p-3 rounded-lg shadow-md flex items-center space-x-3"
            >
              <img
                src={bird.default_photo?.medium_url}
                alt={bird.preferred_common_name || bird.name}
                referrerPolicy="no-referrer"
                className="h-16 w-16 rounded-md object-cover bg-gray-200"
              />
              <p className="flex-1 font-medium text-gray-700 truncate">
                {bird.preferred_common_name || bird.name}
              </p>
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

      {/* --- Quiz Buttons --- */}
      <div className="grid grid-cols-1">
        <button
          onClick={startPhotoQuiz}
          disabled={birds.length < 2}
          className="w-full flex items-center justify-center p-3 bg-green-600 text-white rounded-md font-bold text-lg hover:bg-green-700 transition-colors shadow-lg disabled:opacity-50"
        >
          <Brain className="h-6 w-6 mr-2" />
          Start Photo Quiz!
        </button>
      </div>
    </div>
  );

  const renderPhotoQuiz = () => {
    // ... (rest of the function, no changes)
    if (!quizQuestion) return renderLoading();
    const { bird, options } = quizQuestion;

    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-4">
          Who's this bird?
        </h2>

        <div className="w-full h-64 md:h-96 mb-6 bg-gray-200 rounded-lg shadow-lg overflow-hidden flex items-center justify-center">
          {bird.url ? (
            <img
              src={bird.url}
              alt="Bird for identification"
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 p-4">
              <Ban className="h-16 w-16" />
              <p className="mt-2 text-center">
                No image available for this bird.
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {options.map((option: string) => {
            const isCorrect = option === bird.name;
            const isSelected = option === selectedAnswer;
            let buttonClass =
              "p-3 rounded-md text-left font-medium text-lg transition-all shadow-sm ";

            if (feedback) {
              if (isCorrect)
                buttonClass += "bg-green-500 text-white ring-4 ring-green-300";
              else if (isSelected)
                buttonClass += "bg-red-500 text-white ring-4 ring-red-300";
              else buttonClass += "bg-gray-200 text-gray-500 opacity-60";
            } else {
              buttonClass +=
                "bg-white hover:bg-blue-50 text-gray-800 border border-gray-300 hover:border-blue-500 cursor-pointer";
            }
            return (
              <button
                key={option}
                onClick={() => handlePhotoAnswerSelect(option)}
                disabled={!!feedback}
                className={buttonClass}
              >
                {option}
              </button>
            );
          })}
        </div>

        {feedback && (
          <div className="mt-6 text-center">
            {feedback === "correct" ? (
              <h3 className="text-2xl font-bold text-green-600">Correct!</h3>
            ) : (
              <h3 className="text-2xl font-bold text-red-600">Incorrect</h3>
            )}
            <button
              onClick={generatePhotoQuizQuestion}
              className="mt-4 p-3 bg-blue-600 text-white rounded-md font-semibold text-lg hover:bg-blue-700 transition-colors"
            >
              Next Question
            </button>
          </div>
        )}
      </div>
    );
  };

  // --- Main Render ---
  const renderContent = () => {
    // ... (rest of the function, no changes)
    if (appState === "photoQuiz") {
      return renderPhotoQuiz();
    }
    // Default to manage
    return renderManageBirds();
  };

  return (
    <div className="w-full h-screen bg-gray-100 font-inter antialiased">
      <header className="bg-white shadow-md">
        {/* ... (rest of the header, no changes) ... */}
        <div className="container mx-auto px-4 py-4 flex flex-wrap justify-between items-center">
          <div className="flex items-center space-x-2 mb-2 sm:mb-0">
            <Bird className="h-8 w-8 text-blue-600" />
            <h1 className="text-xl md:text-2xl font-bold text-gray-800">
              Nature Quiz Builder
            </h1>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => {
                setFeedback(null);
                setAppState("manage");
              }}
              disabled={appState === "manage"}
              className={`p-2 rounded-md flex items-center font-semibold transition-colors ${
                appState === "manage"
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-600 hover:bg-gray-200"
              }`}
              title="Manage List"
            >
              <List className="h-5 w-5 sm:mr-1" />
              <span className="hidden sm:inline">Manage List</span>
            </button>
            <button
              onClick={startPhotoQuiz}
              disabled={appState === "photoQuiz" || birds.length < 2}
              className={`p-2 rounded-md flex items-center font-semibold transition-colors ${
                appState === "photoQuiz"
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-600 hover:bg-gray-200"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title="Start Photo Quiz (All)"
            >
              <Brain className="h-5 w-5 sm:mr-1" />
              <span className="hidden sm:inline">Photo Quiz</span>
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div
          className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 m-4 rounded-md"
          role="alert"
        >
          {/* ... (rest of the error, no changes) ... */}
          <p className="font-bold">Error</p>
          <p>{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-2 text-sm font-semibold text-red-600"
          >
            Dismiss
          </button>
        </div>
      )}

      <main className="container mx-auto px-4 py-6 h-[calc(100vh-80px)] overflow-y-auto">
        {renderContent()}
      </main>
    </div>
  );
}
