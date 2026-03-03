import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

interface PaginationWrapperProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  generatePageNumbers: () => (number | string)[]
  startIndex: number
  endIndex: number
  totalItems: number
  itemName?: string
}

export function PaginationWrapper({
  currentPage,
  totalPages,
  onPageChange,
  generatePageNumbers,
  startIndex,
  endIndex,
  totalItems,
  itemName = "itens",
}: PaginationWrapperProps) {
  if (totalPages <= 1) return null

  return (
    <div className="mt-4">
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={(e) => {
                e.preventDefault()
                onPageChange(currentPage - 1)
              }}
              className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
            />
          </PaginationItem>

          {generatePageNumbers().map((numero, index) => (
            <PaginationItem key={index}>
              {numero === '...' ? (
                <PaginationEllipsis />
              ) : (
                <PaginationLink
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    onPageChange(numero as number)
                  }}
                  isActive={currentPage === numero}
                >
                  {numero}
                </PaginationLink>
              )}
            </PaginationItem>
          ))}

          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={(e) => {
                e.preventDefault()
                onPageChange(currentPage + 1)
              }}
              className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>

      <p className="text-center text-sm text-muted-foreground mt-2">
        Mostrando {startIndex + 1} a {Math.min(endIndex, totalItems)} de {totalItems} {itemName}
      </p>
    </div>
  )
}
