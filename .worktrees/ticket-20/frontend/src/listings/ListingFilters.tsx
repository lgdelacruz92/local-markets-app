import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import type { ListingsFilters } from './types.ts'

interface ListingFiltersProps {
  categories: string[]
  onApply: (filters: ListingsFilters) => void
}

export default function ListingFilters({ categories, onApply }: ListingFiltersProps) {
  const [search, setSearch] = useState('')
  const [locality, setLocality] = useState('')
  const [category, setCategory] = useState('')
  const categoryOptionsId = useId()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onApply({ q: search, locality, category })
  }

  function handleClear() {
    setSearch('')
    setLocality('')
    setCategory('')
    onApply({})
  }

  return (
    <form className="listing-filters" aria-label="Filter listings" onSubmit={handleSubmit}>
      <label>
        Search
        <input type="search" name="q" value={search} placeholder="Search items"
          onChange={event => setSearch(event.target.value)} />
      </label>
      <label>
        Locality
        <input type="text" name="locality" value={locality} placeholder="Town or neighbourhood"
          onChange={event => setLocality(event.target.value)} />
      </label>
      <label>
        Category
        <input type="text" name="category" value={category} list={categoryOptionsId}
          placeholder="All categories" onChange={event => setCategory(event.target.value)} />
        <datalist id={categoryOptionsId}>
          {categories.map(value => <option key={value} value={value} />)}
        </datalist>
      </label>
      <div className="filter-actions">
        <button type="submit">Apply filters</button>
        <button type="button" onClick={handleClear}>Clear filters</button>
      </div>
      <p className="filter-help">Leave fields blank to browse all listings. Category suggestions use API values; you can also type a category.</p>
    </form>
  )
}
