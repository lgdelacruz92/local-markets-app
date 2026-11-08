import BrowsePage from './listings/BrowsePage.tsx'
import ListingDetailPage from './listings/ListingDetailPage.tsx'
import { useListings } from './listings/useListings.ts'

function App() {
  const listings = useListings()
  const detailPath = window.location.pathname.match(/^\/listings\/([^/]+)\/?$/)
  if (detailPath) {
    let listingId
    try {
      listingId = decodeURIComponent(detailPath[1])
    } catch {
      return <main><h1>Invalid listing link</h1><a href="/">Browse listings</a></main>
    }
    return <ListingDetailPage key={listingId} listingId={listingId} refreshListings={listings.refetch} />
  }
  return <BrowsePage listings={listings} />
}

export default App
