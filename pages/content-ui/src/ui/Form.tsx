import { ReactNode, createContext, useContext, useCallback, useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { classNames } from './utils';

export type RuleType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'method'
  | 'regexp'
  | 'integer'
  | 'float'
  | 'array'
  | 'object'
  | 'enum'
  | 'date'
  | 'url'
  | 'hex'
  | 'email';

export interface Rule {
  type?: RuleType;
  required?: boolean;
  message?: string;
  pattern?: RegExp;
  min?: number;
  max?: number;
  len?: number;
  validator?: (rule: Rule, value: any) => Promise<void> | void;
}

export interface RuleTypeWithRule {
  [key: string]: Rule;
}

export interface FieldData {
  name: string | string[];
  value?: any;
  rules?: Rule[];
  touched?: boolean;
  validating?: boolean;
  errors?: string[];
}

export interface FormInstance {
  getFieldValue: (name: string | string[]) => any;
  getFieldsValue: () => Record<string, any>;
  setFieldValue: (name: string | string[], value: any) => void;
  setFieldsValue: (values: Record<string, any>) => void;
  setFields: (fields: FieldData[]) => void;
  resetFields: (nameList?: string[]) => void;
  validateFields: (nameList?: string[]) => Promise<Record<string, any>>;
  submit: () => void;
}

interface FormContextValue {
  fields: Record<string, FieldData>;
  setFields: (fields: Record<string, FieldData>) => void;
  registerField: (name: string, field: FieldData) => void;
  unregisterField: (name: string) => void;
  onFieldValueChange: (name: string, value: any) => void;
  submit: () => void;
}

const FormContext = createContext<FormContextValue | null>(null);

const useForm = (): FormInstance => {
  const context = useContext(FormContext);

  if (!context) {
    throw new Error('useForm must be used within a Form component');
  }

  const { fields, setFields: setFieldsState, onFieldValueChange, submit } = context;

  const getFieldValue = useCallback(
    (name: string | string[]) => {
      const normalizedName = Array.isArray(name) ? name.join('.') : name;
      return fields[normalizedName]?.value;
    },
    [fields],
  );

  const getFieldsValue = useCallback(() => {
    const result: Record<string, any> = {};
    Object.keys(fields).forEach(key => {
      result[key] = fields[key].value;
    });
    return result;
  }, [fields]);

  const setFieldValue = useCallback(
    (name: string | string[], value: any) => {
      const normalizedName = Array.isArray(name) ? name.join('.') : name;
      onFieldValueChange(normalizedName, value);
    },
    [onFieldValueChange],
  );

  const setFieldsValue = useCallback(
    (values: Record<string, any>) => {
      Object.keys(values).forEach(key => {
        onFieldValueChange(key, values[key]);
      });
    },
    [onFieldValueChange],
  );

  const setFields = useCallback(
    (newFields: FieldData[]) => {
      const updatedFields = { ...fields };
      newFields.forEach(field => {
        const name = Array.isArray(field.name) ? field.name.join('.') : field.name;
        updatedFields[name] = { ...updatedFields[name], ...field };
      });
      setFieldsState(updatedFields);
    },
    [fields, setFieldsState],
  );

  const resetFields = useCallback(
    (nameList?: string[]) => {
      const updatedFields = { ...fields };
      const names = nameList || Object.keys(fields);
      names.forEach(name => {
        if (updatedFields[name]) {
          updatedFields[name] = { ...updatedFields[name], value: undefined, errors: [] };
        }
      });
      setFieldsState(updatedFields);
    },
    [fields, setFieldsState],
  );

  const validateFields = useCallback(
    async (nameList?: string[]): Promise<Record<string, any>> => {
      const names = nameList || Object.keys(fields);
      const errors: string[] = [];

      for (const name of names) {
        const field = fields[name];
        if (!field) continue;

        const { value, rules = [] } = field;

        for (const rule of rules) {
          if (rule.required && (value === undefined || value === null || value === '')) {
            const error = rule.message || `${name} is required`;
            errors.push(error);
            setFields([{ name, errors: [error], validating: false } as FieldData]);
            break;
          }

          if (rule.pattern && !rule.pattern.test(value)) {
            const error = rule.message || `${name} does not match pattern`;
            errors.push(error);
            setFields([{ name, errors: [error], validating: false } as FieldData]);
            break;
          }

          if (rule.validator) {
            try {
              await rule.validator(rule, value);
            } catch (e: any) {
              const error = e?.message || rule.message || `${name} validation failed`;
              errors.push(error);
              setFields([{ name, errors: [error], validating: false } as FieldData]);
              break;
            }
          }
        }
      }

      if (errors.length > 0) {
        return Promise.reject(errors);
      }

      return getFieldsValue();
    },
    [fields, setFields, getFieldsValue],
  );

  return {
    getFieldValue,
    getFieldsValue,
    setFieldValue,
    setFieldsValue,
    setFields,
    resetFields,
    validateFields,
    submit,
  };
};

interface FormProps {
  initialValues?: Record<string, any>;
  onFinish?: (values: Record<string, any>) => void;
  onFinishFailed?: (errorInfo: any) => void;
  form?: FormInstance;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

const Form = ({ initialValues, onFinish, onFinishFailed, className, style, children }: FormProps) => {
  const [fields, setFieldsState] = useState<Record<string, FieldData>>({});

  const setFields = useCallback((newFields: Record<string, FieldData>) => {
    setFieldsState(newFields);
  }, []);

  const registerField = useCallback(
    (name: string, field: FieldData) => {
      setFieldsState(prev => ({
        ...prev,
        [name]: {
          ...field,
          value: field.value ?? initialValues?.[name],
        },
      }));
    },
    [initialValues],
  );

  const unregisterField = useCallback((name: string) => {
    setFieldsState(prev => {
      const { [name]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const onFieldValueChange = useCallback((name: string, value: any) => {
    setFieldsState(prev => ({
      ...prev,
      [name]: { ...prev[name], value },
    }));
  }, []);

  const submit = useCallback(async () => {
    try {
      const values: Record<string, any> = {};
      Object.keys(fields).forEach(key => {
        values[key] = fields[key].value;
      });
      onFinish?.(values);
    } catch (error) {
      onFinishFailed?.(error);
    }
  }, [fields, onFinish, onFinishFailed]);

  const contextValue: FormContextValue = {
    fields,
    setFields,
    registerField,
    unregisterField,
    onFieldValueChange,
    submit,
  };

  return (
    <FormContext.Provider value={contextValue}>
      <form className={className} style={style}>
        {children}
      </form>
    </FormContext.Provider>
  );
};

interface FormItemProps {
  name?: string | string[];
  label?: ReactNode;
  required?: boolean;
  rules?: Rule[];
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

const FormItem = ({ name, label, required, rules = [], className, style, children }: FormItemProps) => {
  const context = useContext(FormContext);
  const normalizedName = Array.isArray(name) ? name.join('.') : name;
  const [isRegistered, setIsRegistered] = useState(false);

  useEffect(() => {
    if (context && name) {
      context.registerField(normalizedName, {
        name: normalizedName,
        rules,
        touched: false,
        validating: false,
        errors: [],
      });
      setIsRegistered(true);

      return () => {
        context.unregisterField(normalizedName);
      };
    }
  }, [context, name, normalizedName, rules]);

  if (!context) {
    return <>{children}</>;
  }

  const field = context.fields[normalizedName];
  const errors = field?.errors || [];
  const hasError = errors.length > 0;

  const requiredRule = rules.find(r => r.required);
  const isRequired = required || requiredRule?.required;

  return (
    <div className={classNames('mb-4', className)} style={style}>
      {label && (
        <label className="mb-1 block text-sm text-gray-700">
          {isRequired && <span className="mr-1 text-red-500">*</span>}
          {label}
        </label>
      )}
      {children}
      {hasError && (
        <div className="mt-1 text-xs text-red-500">
          {errors.map((error, index) => (
            <div key={index}>{error}</div>
          ))}
        </div>
      )}
    </div>
  );
};

export { Form, FormItem, useForm };
