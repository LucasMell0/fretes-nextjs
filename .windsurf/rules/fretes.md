---
trigger: always_on
---
# GLOBAL ENGINEERING RULES

## 1. Responsiveness (MANDATORY)

- Always build mobile-first.
- All UI must work perfectly on mobile, tablet and desktop.
- Always use Tailwind responsive utilities (sm, md, lg, xl, 2xl).
- Never create fixed width layouts without responsive behavior.
- Test layouts mentally for small screens before generating code.

Responsiveness is not optional.


## 2. Design System & UI

- Always use shadcn/ui components.
- Never build raw HTML elements if a shadcn component exists.
- Always prefer composition over creating new components.
- Reuse Button, Card, Dialog, Sheet, Input, Select, Table, Badge, etc.
- Follow existing spacing and typography patterns.
- Maintain visual consistency across the application.
- Avoid inline styles unless strictly necessary.


## 3. Component Reusability

Before creating a new component:

- Search if a similar component already exists.
- Extend existing components instead of duplicating.
- Avoid creating duplicate UI patterns.
- Keep components small and reusable.
- Separate UI from business logic.


## 4. Multi-Tenant Architecture

- Always assume the system is multi-tenant.
- All database queries must respect tenant isolation.
- Never expose cross-tenant data.
- Always consider tenant_id in database logic.
- Never bypass tenant validation.


## 5. Code Quality

- Use TypeScript strictly.
- Avoid any type when possible.
- Avoid hardcoded values.
- Avoid magic numbers.
- Do not leave console.log in production code.
- Do not generate unused code.
- Prefer clear naming over abbreviations.
- Keep files organized and structured.


## 6. Performance

- Avoid unnecessary re-renders.
- Avoid heavy logic inside components.
- Move heavy logic to server when possible.
- Use dynamic imports when appropriate.
- Keep bundle size optimized.


## 7. Feature Development Rules

When building a feature:

- Check existing patterns first.
- Follow folder structure.
- Keep scalability in mind.
- Keep UI consistent.
- Ensure full responsiveness.
- Ensure tenant isolation.


## 8. If Conflict Occurs

If a request conflicts with these rules,
prioritize these rules over creativity.

Always explain why you are creating something new if similar logic already exists.

When uncertain between two implementations,
propose 2 structured solutions and explain tradeoffs.