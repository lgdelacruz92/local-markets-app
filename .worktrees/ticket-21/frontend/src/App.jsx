import BrowsePage from './listings/BrowsePage.tsx'
import ListingDetailPage from './listings/ListingDetailPage.tsx'

function App() {
  const detailPath = window.location.pathname.match(/^\/listings\/([^/]+)\/?$/)
  if (detailPath) {
    let listingId
    try {
      listingId = decodeURIComponent(detailPath[1])
    } catch {
      return <main><h1>Invalid listing link</h1><a href="/">Browse listings</a></main>
    }
    return <ListingDetailPage key={listingId} listingId={listingId} />
  }
  return <BrowsePage />
}

export default App
