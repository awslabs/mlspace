---
inclusion: always
---

# Task Coding Standards

## Library Usage Consistency

When working with libraries, always use their provided objects and data structures instead of falling back to plain dictionaries or primitive types:

- Use library-specific classes, objects, and data structures
- Leverage type safety and validation provided by library objects
- Avoid converting library objects to plain dicts unless absolutely necessary
- When serialization is needed, use the library's built-in serialization methods

**Examples:**
- Use `dataclasses` or `pydantic` models instead of plain dicts
- Use `datetime` objects instead of string dates
- Use library-specific request/response objects instead of raw JSON

## Enum Usage

Prefer enums over repeated string literals throughout the codebase:

- Create enums for any set of string constants that appear multiple times
- Use enums for status values, types, categories, and configuration options
- Import and reference enums consistently across modules
- Consider using `StrEnum` for string-based enums when appropriate

**Examples:**
```python
# Good
class TaskStatus(StrEnum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"

# Avoid
status = "pending"  # repeated throughout code
```

## Function Size Management

Keep functions focused and reasonably sized:

- Break down large functions into smaller, single-purpose functions
- Aim for functions that can be easily understood and tested
- Extract complex logic into helper functions
- Use descriptive function names that clearly indicate purpose
- Consider the single responsibility principle

**Guidelines:**
- If a function has more than 20-30 lines, consider refactoring
- If a function has multiple levels of nesting, extract inner logic
- If a function handles multiple concerns, split into separate functions
- Use early returns to reduce nesting depth