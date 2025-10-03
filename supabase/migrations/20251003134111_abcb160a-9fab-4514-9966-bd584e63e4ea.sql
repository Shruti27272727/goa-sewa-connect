-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('citizen', 'officer', 'admin');

-- Create enum for application status
CREATE TYPE public.application_status AS ENUM ('pending', 'under_review', 'approved', 'rejected', 'additional_info_required');

-- Create enum for payment status
CREATE TYPE public.payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  phone TEXT,
  full_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'citizen',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- User roles policies
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create aadhaar_details table
CREATE TABLE public.aadhaar_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  citizen_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  aadhaar_number TEXT NOT NULL UNIQUE,
  date_of_birth DATE NOT NULL,
  gender TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on aadhaar_details
ALTER TABLE public.aadhaar_details ENABLE ROW LEVEL SECURITY;

-- Aadhaar policies
CREATE POLICY "Citizens can view their own aadhaar"
  ON public.aadhaar_details FOR SELECT
  USING (auth.uid() = citizen_id);

CREATE POLICY "Citizens can insert their own aadhaar"
  ON public.aadhaar_details FOR INSERT
  WITH CHECK (auth.uid() = citizen_id);

CREATE POLICY "Officers can view all aadhaar"
  ON public.aadhaar_details FOR SELECT
  USING (public.has_role(auth.uid(), 'officer') OR public.has_role(auth.uid(), 'admin'));

-- Create addresses table
CREATE TABLE public.addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  citizen_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'Goa',
  pincode TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on addresses
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

-- Addresses policies
CREATE POLICY "Citizens can view their own addresses"
  ON public.addresses FOR SELECT
  USING (auth.uid() = citizen_id);

CREATE POLICY "Citizens can insert their own addresses"
  ON public.addresses FOR INSERT
  WITH CHECK (auth.uid() = citizen_id);

CREATE POLICY "Citizens can update their own addresses"
  ON public.addresses FOR UPDATE
  USING (auth.uid() = citizen_id);

CREATE POLICY "Citizens can delete their own addresses"
  ON public.addresses FOR DELETE
  USING (auth.uid() = citizen_id);

-- Create departments table
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on departments
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Departments policies (public read)
CREATE POLICY "Anyone can view departments"
  ON public.departments FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage departments"
  ON public.departments FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Create services table
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  fee DECIMAL(10, 2) NOT NULL DEFAULT 0,
  required_documents TEXT[],
  processing_time_days INTEGER NOT NULL DEFAULT 7,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on services
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Services policies
CREATE POLICY "Anyone can view active services"
  ON public.services FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage services"
  ON public.services FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Create applications table
CREATE TABLE public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  citizen_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  officer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.application_status NOT NULL DEFAULT 'pending',
  remarks TEXT,
  applied_on TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_on TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on applications
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- Applications policies
CREATE POLICY "Citizens can view their own applications"
  ON public.applications FOR SELECT
  USING (auth.uid() = citizen_id);

CREATE POLICY "Citizens can create applications"
  ON public.applications FOR INSERT
  WITH CHECK (auth.uid() = citizen_id);

CREATE POLICY "Officers can view all applications"
  ON public.applications FOR SELECT
  USING (public.has_role(auth.uid(), 'officer') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Officers can update applications"
  ON public.applications FOR UPDATE
  USING (public.has_role(auth.uid(), 'officer') OR public.has_role(auth.uid(), 'admin'));

-- Create documents table
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  doc_type TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on documents
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Documents policies
CREATE POLICY "Citizens can view documents for their applications"
  ON public.documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.applications
      WHERE applications.id = documents.application_id
      AND applications.citizen_id = auth.uid()
    )
  );

CREATE POLICY "Citizens can insert documents for their applications"
  ON public.documents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.applications
      WHERE applications.id = documents.application_id
      AND applications.citizen_id = auth.uid()
    )
  );

CREATE POLICY "Officers can view all documents"
  ON public.documents FOR SELECT
  USING (public.has_role(auth.uid(), 'officer') OR public.has_role(auth.uid(), 'admin'));

-- Create payments table
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  transaction_id TEXT,
  amount DECIMAL(10, 2) NOT NULL,
  status public.payment_status NOT NULL DEFAULT 'pending',
  payment_method TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Payments policies
CREATE POLICY "Citizens can view payments for their applications"
  ON public.payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.applications
      WHERE applications.id = payments.application_id
      AND applications.citizen_id = auth.uid()
    )
  );

CREATE POLICY "Citizens can create payments for their applications"
  ON public.payments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.applications
      WHERE applications.id = payments.application_id
      AND applications.citizen_id = auth.uid()
    )
  );

CREATE POLICY "Officers can view all payments"
  ON public.payments FOR SELECT
  USING (public.has_role(auth.uid(), 'officer') OR public.has_role(auth.uid(), 'admin'));

-- Create trigger function for updating timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_applications_updated_at
  BEFORE UPDATE ON public.applications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger function for new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User')
  );
  
  -- Assign citizen role by default
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'citizen');
  
  RETURN NEW;
END;
$$;

-- Create trigger for new user
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Insert sample departments
INSERT INTO public.departments (name, description) VALUES
  ('Revenue Department', 'Handles land records, certificates, and revenue-related services'),
  ('Panchayat Department', 'Manages village panchayat services and rural development'),
  ('Transport Department', 'Handles vehicle registration, licenses, and transport permits'),
  ('Health Department', 'Manages health services and certificates');

-- Insert sample services
INSERT INTO public.services (department_id, name, description, fee, required_documents, processing_time_days) VALUES
  (
    (SELECT id FROM public.departments WHERE name = 'Revenue Department'),
    'Residence Certificate',
    'Certificate of residence for Goa citizens',
    50.00,
    ARRAY['Aadhaar Card', 'Address Proof', 'Passport Photo'],
    7
  ),
  (
    (SELECT id FROM public.departments WHERE name = 'Revenue Department'),
    'Income Certificate',
    'Certificate of annual income for various purposes',
    50.00,
    ARRAY['Aadhaar Card', 'Income Proof', 'Passport Photo'],
    10
  ),
  (
    (SELECT id FROM public.departments WHERE name = 'Health Department'),
    'Birth Certificate',
    'Official birth registration certificate',
    25.00,
    ARRAY['Hospital Birth Record', 'Parents Aadhaar', 'Passport Photo'],
    15
  ),
  (
    (SELECT id FROM public.departments WHERE name = 'Health Department'),
    'Death Certificate',
    'Official death registration certificate',
    25.00,
    ARRAY['Hospital Death Record', 'Deceased Aadhaar', 'Applicant ID Proof'],
    15
  ),
  (
    (SELECT id FROM public.departments WHERE name = 'Panchayat Department'),
    'Caste Certificate',
    'Certificate of caste for reservation purposes',
    50.00,
    ARRAY['Aadhaar Card', 'School/College Certificate', 'Passport Photo'],
    14
  );

-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public) VALUES ('application-documents', 'application-documents', false);

-- Storage policies for documents
CREATE POLICY "Citizens can upload documents for their applications"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'application-documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Citizens can view their own documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'application-documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Officers can view all documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'application-documents' AND
    (public.has_role(auth.uid(), 'officer') OR public.has_role(auth.uid(), 'admin'))
  );