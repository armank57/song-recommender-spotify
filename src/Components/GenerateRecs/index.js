import { useEffect, useState } from 'react';
import './GenerateRecs.css';
import TwoLists from '../TwoLists';
import ViewPlaylist from '../ViewPlaylist';

async function fetchWebApi(endpoint, method, body) {
  let accessToken = sessionStorage.getItem('access_token');
  
  const res = await fetch(`https://api.spotify.com/${endpoint}`, {
      headers: {
        Authorization: 'Bearer ' + accessToken,
      },
      method,
      body: JSON.stringify(body)
    });
  return await res.json();
}

function GenerateRecs() {

  const [isClicked, setIsClicked] = useState(false);
  const [playlistMade, setPlaylistMade] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const topTracksIds = []; // ids for getting recommendations
  const chunkedTopTrackIds = [];
  const recommendedTracks = []; // URIs for making playlists

  const [oldTracks, setOldTracks] = useState([]); // info for old tracks for DisplaySongs
  const [newTracks, setNewTracks] = useState([]); // info for new tracks for DisplaySongs
  const [recsUri, setRecsUri] = useState([]); // holds the uris for recommendations for the button event handler
  const [playlistLink, setPlaylistLink] = useState(""); // contains link to created playlist

  /* Parses the topTrackIds into chunks of 5 */
  function parseTopTracks() {
    let counter = 0;
    for (let i = 0; i < 10; i++) {
      const temp = [];
      for (let j = 0; j < 5; j++) {
        temp[j] = topTracksIds[counter];
        counter++;
      }
      chunkedTopTrackIds.push(temp);
    }
  }
  
  async function getTopTracks() {
    return (await fetchWebApi('v1/me/top/tracks?time_range=short_term&limit=50', 'GET')).items;
  }

  async function getRecommendations(index) {
    return (await fetchWebApi(`v1/recommendations?limit=5&seed_tracks=${chunkedTopTrackIds[index].join(',')}`, 'GET')).tracks;
  }

  async function createPlaylist(tracksUri) {
    const { id: user_id } = await fetchWebApi('v1/me', 'GET');

    const playlist = await fetchWebApi(`v1/users/${user_id}/playlists`, 'POST', {
      "name": `${user_id}'s Beats by Chimp`,
      "description": `oo oo ah ah 🐒`,
      "public": false
    });

    await fetchWebApi(`v1/playlists/${playlist.id}/tracks?uris=${tracksUri.join(',')}`, 'POST');

    return playlist;
  }

  useEffect(() => {
    async function loadTracks() {
      try {
        const result = await getTopTracks();
        const oldTracksData = result.map((track) => ({
          name: track.name,
          album: track.album.name,
          artists: track.artists,
          image: track.album.images[0].url,
          id: track.id,
          link: track.external_urls.spotify,
        }));
        setOldTracks(oldTracksData);

        for (let i = 0; i < 50; i++) {
          topTracksIds[i] = result[i].id;
        }

        parseTopTracks();

        /* Fills the recommendedTracks array */

        const newTracksData = [];
        const newTracksIds = [];
        let counter = 0;
        for (let i = 0; i < 10; i++) {
          
          let tempRecs = [];

          /* Following do-while loop rejects repeating tracks from being recommended */
          let repeat = 0;
          do {
            repeat = 0;
            tempRecs = await getRecommendations(i);
            for (let j = 0; j < 5; j++) {
              if (newTracksIds.includes(tempRecs[j].id) || topTracksIds.includes(tempRecs[j].id)) {
                repeat = 1;
                break;
              }
            }
          } while (repeat == 1);
          
          for (let j = 0; j < 5; j++) {
            recommendedTracks[counter] = tempRecs[j].uri;
            newTracksData[counter] =
              {
                name: tempRecs[j].name,
                album: tempRecs[j].album.name,
                artists: tempRecs[j].artists,
                image: tempRecs[j].album.images[0].url,
                id: tempRecs[j].id,
                link: tempRecs[j].external_urls.spotify,
              };
            newTracksIds[counter] = tempRecs[j].id;
            counter++;
          }
        }

        setRecsUri(recommendedTracks);
        setNewTracks(newTracksData);
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching top tracks:', error);
      }
    }

    if (!playlistMade) {
      loadTracks();
    }
  }, []);

  /* Upon click, we get the top tracks that the user listens to */
  const handleClick = async () => {
    if (!isClicked) {
      setIsClicked(true);

      const createdPlaylist = await createPlaylist(recsUri);

      setPlaylistMade(true);
      setPlaylistLink(createdPlaylist.external_urls.spotify);
    }
  };

  return (
        <div>
          { isLoading ?
          <h3>Loading...</h3>
          : (isClicked && playlistMade) ?
            <div>
              <ViewPlaylist playlistURL={playlistLink}/>
              <TwoLists left={oldTracks} right={newTracks}/>
            </div>
            : 
            <div>
              <p className="p1">Click the button below to view your top 50 songs from the past few weeks, 
                a list of 50 suggested tracks, and a playlist with all of those recommendations directly into your account.</p>
              <button role="button" className="button-1" onClick={handleClick}>Generate Playlist</button>
            </div>
          }
        </div>
  );
}

export default GenerateRecs;