"use client";

import * as React from "react";
import { cn } from "../../lib/utils";
import { Label } from "./label";
import { Slot } from "./slot";

// Simplified form context for react-hook-form compatibility
interface FormContextValue {
  formState?: {
    errors?: Record<string, any>;
  };
  getFieldState?: (name: string) => {
    error?: { message?: string };
    invalid?: boolean;
  };
}

const FormContext = React.createContext<FormContextValue | null>(null);

// Simplified FormProvider that accepts react-hook-form's FormProvider or a simple object
const Form = ({ children, ...props }: any) => {
  return (
    <FormContext.Provider value={props}>
      {children}
    </FormContext.Provider>
  );
};

type FormFieldContextValue<
  TFieldValues extends Record<string, any> = Record<string, any>,
  TName extends string = string,
> = {
  name: TName;
};

const FormFieldContext = React.createContext<FormFieldContextValue>(
  {} as FormFieldContextValue
);

// Simplified FormField that works with or without react-hook-form
const FormField = <
  TFieldValues extends Record<string, any> = Record<string, any>,
  TName extends string = string,
>({
  name,
  children,
  ...props
}: {
  name: TName;
  children?: React.ReactNode;
  [key: string]: any;
}) => {
  return (
    <FormFieldContext.Provider value={{ name }}>
      {children}
    </FormFieldContext.Provider>
  );
};

const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext);
  const itemContext = React.useContext(FormItemContext);
  const formContext = React.useContext(FormContext);

  if (!fieldContext) {
    throw new Error("useFormField should be used within <FormField>");
  }

  const { id } = itemContext;
  const fieldState = formContext?.getFieldState?.(fieldContext.name) || {};
  const error = fieldState.error || formContext?.formState?.errors?.[fieldContext.name];

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    error,
    invalid: fieldState.invalid || !!error,
  };
};

type FormItemContextValue = {
  id: string;
};

const FormItemContext = React.createContext<FormItemContextValue>(
  {} as FormItemContextValue
);

function FormItem({ className, ...props }: React.ComponentProps<"div">) {
  const id = React.useId();

  return (
    <FormItemContext.Provider value={{ id }}>
      <div
        data-slot="form-item"
        className={cn("grid gap-2", className)}
        {...props}
      />
    </FormItemContext.Provider>
  );
}

function FormLabel({
  className,
  ...props
}: React.ComponentProps<typeof Label>) {
  const { error, formItemId } = useFormField();

  return (
    <Label
      data-slot="form-label"
      data-error={!!error}
      className={cn("data-[error=true]:text-destructive", className)}
      htmlFor={formItemId}
      {...props}
    />
  );
}

function FormControl({ ...props }: React.ComponentProps<typeof Slot>) {
  const { error, formItemId, formDescriptionId, formMessageId } =
    useFormField();

  return (
    <Slot
      data-slot="form-control"
      id={formItemId}
      aria-describedby={
        !error
          ? `${formDescriptionId}`
          : `${formDescriptionId} ${formMessageId}`
      }
      aria-invalid={!!error}
      {...props}
    />
  );
}

function FormDescription({ className, ...props }: React.ComponentProps<"p">) {
  const { formDescriptionId } = useFormField();

  return (
    <p
      data-slot="form-description"
      id={formDescriptionId}
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

function FormMessage({ className, ...props }: React.ComponentProps<"p">) {
  const { error, formMessageId } = useFormField();
  const body = error ? String(error?.message ?? "") : props.children;

  if (!body) {
    return null;
  }

  return (
    <p
      data-slot="form-message"
      id={formMessageId}
      className={cn("text-destructive text-sm", className)}
      {...props}
    >
      {body}
    </p>
  );
}

export {
  useFormField,
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField,
};
