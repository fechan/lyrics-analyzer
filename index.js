"use strict";
(function() {
  const LYRICS_API_BASE = "https://api.lyrics.ovh";
  const stopTypingMs = 50;
  window.addEventListener('load', init);
  let searchTimeoutId = null;
  let currentLyrics = null;
  let currentChart = null;

  /**
   * Initializes the app
   */
  function init() {
    let atLeastTwo = document.getElementById("at-least-two");
    atLeastTwo.addEventListener("click", () => renderChart(currentLyrics, atLeastTwo.checked ? 2 : 1));

    let searchBar = document.querySelector("input[name='search']");
    searchBar.addEventListener('input', startSearchTimeout);
    searchBar.addEventListener('keyup', event => {
      if (event.key === "Enter") {
        getSuggestions();
      }
    });
    let suggestions = document.getElementById("suggestions");
    searchBar.addEventListener('click', () => suggestions.classList.remove("d-none"));
  }

  /**
   * Starts a timeout for searching the song with the API.
   * If the user types more stuff before the timeout ends, it kills the existing one and starts anew
   * This prevents us from spamming the API with incomplete queries
   */
  function startSearchTimeout() {
    if (searchTimeoutId !== null) {
      clearTimeout(searchTimeoutId);
    }
    searchTimeoutId = setTimeout(getSuggestions, stopTypingMs);
  }

  /**
   * Gets song suggestions based on the value of the element triggering this
   */
  function getSuggestions() {
    let query = document.querySelector("input[name='search']").value;
    if (query !== "") {
      fetch(LYRICS_API_BASE + "/suggest/" + query)
        .then(fetchSucceeded)
        .then(response => response.json())
        .then(showSuggestions)
        .catch(suggestionFailed);
    }
  }

  /**
   * Shows a failure message for suggesting songs
   */
  function suggestionFailed() {
    let suggestions = document.getElementById("suggestions");
    suggestions.innerHTML = "";
    suggestions.classList.remove("d-none");
    suggestions.textContent = "Unable to contact song server. Please try again later.";
  }

  /**
   * Shows song suggestions listed in the suggest API method response JSON
   * @param {Object} json suggest API method response JSON object
   */
  function showSuggestions(json) {
    let suggestions = document.getElementById("suggestions");
    suggestions.classList.remove("d-none");
    if (json.total !== 0) {
      suggestions.innerHTML = "";
      for (let song of json.data) {
        let suggestion = document.createElement("li");
        suggestion.textContent = `${song.artist.name} - ${song.title}`;
        if (song.explicit_lyrics) {
          let warning = document.createElement("span");
          warning.classList.add("badge", "badge-warning");
          warning.textContent = "Explicit";
          suggestion.append(warning);
        }
        suggestion.addEventListener("click", () => suggestionClicked(song));
        suggestions.appendChild(suggestion);
      }
    } else {
      suggestions.textContent = "No song with this title found.";
    }
  }

  /**
   * Gets lyrics for a song
   * @param {Object} song object containing song data from suggest API method
   */
  function suggestionClicked(song) {
    document.getElementById("suggestions").classList.add("d-none");
    fetch(`${LYRICS_API_BASE}/v1/${song.artist.name}/${song.title}`)
      .then(fetchSucceeded)
      .then(response => response.json())
      .then(lyricsJSON => showSong(lyricsJSON, song))
      .catch(lyricsFailed);
  }

  /**
   * Show fail message for showing lyrics
   * @param {Error} reason reason for error
   */
  function lyricsFailed(reason) {
    console.error(reason);
    let lyricViewer = document.querySelector("article");
    let songInfo = document.querySelector("aside");
    lyricViewer.innerHTML = "";
    songInfo.innerHTML = "";
    let error = elementWithText("p", "Couldn't get lyrics. Maybe try another version of the song?");
    lyricViewer.appendChild(error);
  }

  /**
   * Puts the lyrics and song details on screen
   * @param {Object} lyricsJSON parsed json object of the lyrics API response
   * @param {Object} song object containing song data from suggest API method
   */
  function showSong(lyricsJSON, song) {
    currentLyrics = lyricsJSON.lyrics;
    let lyricViewer = document.querySelector("article");
    lyricViewer.textContent = currentLyrics;

    let analysis = document.getElementById("analysis");
    analysis.classList.remove("d-none");
    analysis.classList.add("d-flex");
    let atLeastTwo = document.getElementById("at-least-two").checked;
    renderChart(currentLyrics, atLeastTwo ? 2 : 1);

    let songDetails = document.querySelector("aside");
    songDetails.innerHTML = "";
    let title = elementWithText("h1", `${song.artist.name} - ${song.title}`);
    let album = elementWithText("p", song.album.title);
    let albumCover = document.createElement("img");
    albumCover.src = song.album.cover_medium;
    let ytLink = elementWithText("a", "Search on YouTube »");
    ytLink.href = `https://www.youtube.com/results?search_query=${song.artist.name} - ${song.title}`;
    [title, album, albumCover, ytLink].forEach(element => songDetails.appendChild(element));
  }

  /**
   * Shows the frequency chart of words in lyrics
   * @param {String} rawLyrics Raw lyrics string
   * @param {Number} frequencyThreshold Minimum occurrences required to be shown on chart
   */
  function renderChart(rawLyrics, frequencyThreshold) {
    if (currentLyrics === null) {
      return;
    }
    if (currentChart !== null) {
      currentChart.destroy();
    }
    let chartCtx = document.getElementById("chart");

    rawLyrics = rawLyrics.toLowerCase();
    let uniqueWords = [...new Set(rawLyrics.match(/\S+/g) || [])]; // Creates a whitespace split array without dupes
    document.getElementById("num-unique").textContent = uniqueWords.length;
    let frequencies = {};
    for (let word of uniqueWords) {
      let regexString = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      let wordCount = rawLyrics.match(new RegExp(regexString, "g")).length;
      if (wordCount >= frequencyThreshold) {
        frequencies[word] = wordCount;
      }
    }
    currentChart = new Chart(chartCtx, {
      type: "bar",
      data: {
        datasets: [{
          label: "Number of occurrences",
          data: Object.values(frequencies),
          backgroundColor: "#36a2eb"
        }],
        labels: Object.keys(frequencies)
      },
      options: {
        scaleShowValues: true,
        scales: {
          xAxes: [{
            ticks: {
              autoSkip: false
            }
          }]
        }
      }
    });
  }

  /**
   * Creates an element with text in it
   * @param {String} elementName name of element to make
   * @param {String} text text to put in element
   * @returns {HTMLElement} element with text in it
   */
  function elementWithText(elementName, text) {
    let element = document.createElement(elementName);
    element.textContent = text;
    return element;
  }

  /**
   * Throws an error for a failed fetch call, returns the response otherwise
   * @param {Response} response response to a fetch call
   */
  function fetchSucceeded(response) {
    if (response.ok || response.redirected) {
      return response;
    }
    throw Error("Fetch request failed: " + response.statusText);
  }
})();
