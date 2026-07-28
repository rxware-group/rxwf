import { cloneElement, isValidElement, useId, type ReactNode } from 'react';

export type FormFieldVariant = 'default' | 'compact' | 'inline';

export interface FormFieldProps {
  label: ReactNode;
  htmlFor?: string;
  labelExtra?: ReactNode;
  children: ReactNode;
  className?: string;
  variant?: FormFieldVariant;
}

function variantClass(variant: FormFieldVariant): string {
  if (variant === 'compact') return 'rxwf-form-field--compact';
  if (variant === 'inline') return 'rxwf-form-field--inline';
  return '';
}

export function FormField({
  label,
  htmlFor,
  labelExtra,
  children,
  className,
  variant = 'default',
}: FormFieldProps) {
  const generatedId = useId().replace(/:/g, '');
  const controlId = htmlFor ?? generatedId;

  let control = children;
  if (isValidElement<{ id?: string }>(children) && children.props.id == null) {
    control = cloneElement(children, { id: controlId });
  }

  const rootClass = ['rxwf-form-field', variantClass(variant), className]
    .filter(Boolean)
    .join(' ');

  if (variant === 'inline') {
    return (
      <label className={rootClass} htmlFor={controlId}>
        {control}
        <span className="rxwf-form-field-label">{label}</span>
      </label>
    );
  }

  return (
    <div className={rootClass}>
      <div className="rxwf-form-field-label-row">
        <label className="rxwf-form-field-label" htmlFor={controlId}>
          {label}
        </label>
        {labelExtra}
      </div>
      <div className="rxwf-form-field-control">{control}</div>
    </div>
  );
}
