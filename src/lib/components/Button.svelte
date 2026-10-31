<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements'

  export type ButtonVariant = 'primary' | 'secondary' | 'ghost'
  export type ButtonSize = 'sm' | 'md' | 'lg'

  const variants = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    ghost: 'btn-ghost',
  } as const

  const sizes = {
    sm: 'btn-sm',
    md: 'btn-md',
    lg: 'btn-lg',
  } as const

  let {
    variant = 'secondary',
    size = 'md',
    class: className = '',
    type = 'button',
    href,
    disabled = false,
    children,
    ...rest
  }: {
    variant?: ButtonVariant
    size?: ButtonSize
    class?: string
    type?: HTMLButtonAttributes['type']
    href?: string
    disabled?: boolean
    children?: Snippet
  } & Omit<HTMLButtonAttributes, 'class' | 'children' | 'href' | 'type' | 'disabled'> &
    Pick<HTMLAnchorAttributes, 'rel' | 'target'> = $props()
</script>

<svelte:element
  this={href ? 'a' : 'button'}
  class="btn {variants[variant]} {sizes[size]} {className}"
  href={href && !disabled ? href : undefined}
  type={href ? undefined : type}
  disabled={href ? undefined : disabled}
  aria-disabled={href ? disabled : undefined}
  role={href && disabled ? 'link' : undefined}
  tabindex={href && disabled ? -1 : undefined}
  {...rest}
>
  {@render children?.()}
</svelte:element>
