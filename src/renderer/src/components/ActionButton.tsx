import { Icon } from './Icon'
import type { IconName } from '../types'

export interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName
  iconOnly?: boolean
}

export function ActionButton({
  children,
  className,
  icon,
  iconOnly = false,
  type = 'button',
  ...props
}: ActionButtonProps): React.JSX.Element {
  return (
    <button
      type={type}
      className={`ui-button ${iconOnly ? 'icon-only' : ''} ${className ?? ''}`.trim()}
      {...props}
    >
      <span className="button-icon" aria-hidden="true">
        <Icon name={icon} />
      </span>
      {children ? <span className="button-label">{children}</span> : null}
    </button>
  )
}
