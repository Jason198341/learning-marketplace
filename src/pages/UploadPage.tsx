import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  Upload,
  FileText,
  Image,
  Info,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { Button, Input, Select } from '@/components/common';
import { useToast } from '@/components/common/Toast';
import { api, ApiError } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import {
  Grade,
  Subject,
  Category,
  GRADE_LABELS,
  SUBJECT_LABELS,
  CATEGORY_LABELS,
} from '@/types';

interface UploadForm {
  title: string;
  description: string;
  grade: Grade;
  subject: Subject;
  category: Category;
  price: number;
  pageCount: number;
}

const PRICE_OPTIONS = [
  { value: 100, label: '100P' },
  { value: 150, label: '150P' },
  { value: 200, label: '200P' },
  { value: 250, label: '250P' },
  { value: 300, label: '300P' },
  { value: 350, label: '350P' },
  { value: 400, label: '400P' },
  { value: 450, label: '450P' },
  { value: 500, label: '500P' },
];

export function UploadPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const user = useAuthStore((state) => state.user);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [worksheetFile, setWorksheetFile] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<UploadForm>({
    defaultValues: {
      title: '',
      description: '',
      grade: 'elementary_1',
      subject: 'korean',
      category: 'worksheet',
      price: 200,
      pageCount: 1,
    },
  });

  const gradeOptions = Object.entries(GRADE_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  const subjectOptions = Object.entries(SUBJECT_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  const categoryOptions = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  const handleWorksheetUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      ];
      if (!allowedTypes.includes(file.type)) {
        toast.error('PDF, Word, PowerPoint 문서만 업로드 가능합니다.');
        return;
      }
      // Validate file size (max 50MB)
      if (file.size > 50 * 1024 * 1024) {
        toast.error('파일 크기는 50MB 이하여야 합니다.');
        return;
      }
      setWorksheetFile(file);
    }
  };

  const handlePreviewUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('이미지 파일만 업로드 가능합니다.');
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('이미지 크기는 5MB 이하여야 합니다.');
        return;
      }
      setPreviewImage(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const onSubmit = async (data: UploadForm) => {
    if (!worksheetFile) {
      toast.error('워크시트 파일을 업로드해주세요.');
      return;
    }
    if (!previewImage) {
      toast.error('미리보기 이미지를 업로드해주세요.');
      return;
    }
    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Step 1: Upload worksheet file to Supabase Storage with metadata
      setUploadProgress('워크시트 파일 업로드 중...');
      const fileUrl = await api.storage.uploadWorksheet(worksheetFile, user.id, {
        grade: data.grade,
        subject: data.subject,
        category: data.category,
        pageCount: data.pageCount || 1,
      });

      // Step 2: Upload preview image to Supabase Storage
      setUploadProgress('미리보기 이미지 업로드 중...');
      const previewImageUrl = await api.storage.uploadPreview(previewImage, user.id);

      // Step 3: Create worksheet record in database
      setUploadProgress('워크시트 등록 중...');
      const result = await api.worksheets.create({
        ...data,
        fileUrl,
        previewImage: previewImageUrl,
      });

      toast.success('워크시트가 등록되었습니다!');
      navigate(`/worksheet/${result.id}`);
    } catch (error) {
      console.error('Upload error:', error);
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('등록에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  };

  const selectedPrice = watch('price');

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">자료 등록</h1>
        <p className="text-gray-600">
          학습 자료를 등록하고 다른 선생님/학부모님과 공유하세요
        </p>
      </div>

      {/* Guidelines */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-8">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-2">등록 가이드라인</p>
            <ul className="list-disc list-inside space-y-1 text-blue-700">
              <li>직접 제작한 자료만 등록해주세요</li>
              <li>저작권에 문제가 없는 자료여야 합니다</li>
              <li>미리보기 이미지는 자료의 첫 페이지를 권장합니다</li>
              <li>가격은 100P~500P 사이로 설정 가능합니다</li>
              <li><strong>허용 파일:</strong> PDF, DOC, DOCX, PPT, PPTX (최대 50MB)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* File naming notice */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-8">
        <div className="flex items-start gap-3">
          <FileText className="w-5 h-5 text-gray-600 shrink-0 mt-0.5" />
          <div className="text-sm text-gray-700">
            <p className="font-medium mb-1">파일명 자동 변환 안내</p>
            <p className="text-gray-600 mb-2">
              업로드된 파일은 아래 형식으로 자동 변환됩니다:
            </p>
            <code className="block bg-white border border-gray-200 rounded px-3 py-2 text-xs text-gray-800">
              학년_과목_유형_페이지수p_사용자ID_업로드시각.확장자
            </code>
            <p className="text-gray-500 mt-2 text-xs">
              예: elementary_3_math_worksheet_10p_a1b2c3d4_20260131_143022.pdf
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* File Upload Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Worksheet File */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              워크시트 파일 <span className="text-red-500">*</span>
            </label>
            <div
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                worksheetFile
                  ? 'border-secondary-300 bg-secondary-50'
                  : 'border-gray-300 hover:border-primary-400 hover:bg-primary-50'
              }`}
            >
              {worksheetFile ? (
                <div className="space-y-2">
                  <CheckCircle className="w-10 h-10 mx-auto text-secondary-600" />
                  <p className="font-medium text-gray-900">{worksheetFile.name}</p>
                  <p className="text-sm text-gray-500">
                    {(worksheetFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <button
                    type="button"
                    onClick={() => setWorksheetFile(null)}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    파일 제거
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer">
                  <FileText className="w-10 h-10 mx-auto text-gray-400 mb-2" />
                  <p className="text-gray-600 mb-1">
                    PDF 또는 Word 파일을 업로드하세요
                  </p>
                  <p className="text-sm text-gray-400">최대 50MB</p>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.ppt,.pptx"
                    onChange={handleWorksheetUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Preview Image */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              미리보기 이미지 <span className="text-red-500">*</span>
            </label>
            <div
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                previewImage
                  ? 'border-secondary-300 bg-secondary-50'
                  : 'border-gray-300 hover:border-primary-400 hover:bg-primary-50'
              }`}
            >
              {previewImage && previewUrl ? (
                <div className="space-y-2">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-24 h-32 mx-auto object-cover rounded-lg"
                  />
                  <p className="font-medium text-gray-900 truncate max-w-full">
                    {previewImage.name}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewImage(null);
                      setPreviewUrl(null);
                    }}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    이미지 제거
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer">
                  <Image className="w-10 h-10 mx-auto text-gray-400 mb-2" />
                  <p className="text-gray-600 mb-1">
                    이미지 파일을 업로드하세요
                  </p>
                  <p className="text-sm text-gray-400">최대 5MB</p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePreviewUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Title */}
        <Input
          label="제목"
          placeholder="워크시트 제목을 입력하세요"
          error={errors.title?.message}
          {...register('title', {
            required: '제목을 입력해주세요.',
            minLength: {
              value: 5,
              message: '제목은 5자 이상이어야 합니다.',
            },
            maxLength: {
              value: 100,
              message: '제목은 100자 이하여야 합니다.',
            },
          })}
        />

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            설명 <span className="text-red-500">*</span>
          </label>
          <textarea
            placeholder="워크시트에 대한 상세 설명을 작성해주세요&#10;(대상 학년, 학습 목표, 활용 방법 등)"
            rows={5}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none ${
              errors.description ? 'border-red-500' : 'border-gray-300'
            }`}
            {...register('description', {
              required: '설명을 입력해주세요.',
              minLength: {
                value: 20,
                message: '설명은 20자 이상이어야 합니다.',
              },
            })}
          />
          {errors.description && (
            <p className="mt-1 text-sm text-red-500">{errors.description.message}</p>
          )}
        </div>

        {/* Category Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Select
            label="학년"
            options={gradeOptions}
            value={watch('grade')}
            onChange={(value: string) => setValue('grade', value as Grade)}
          />
          <Select
            label="과목"
            options={subjectOptions}
            value={watch('subject')}
            onChange={(value: string) => setValue('subject', value as Subject)}
          />
          <Select
            label="유형"
            options={categoryOptions}
            value={watch('category')}
            onChange={(value: string) => setValue('category', value as Category)}
          />
        </div>

        {/* Page Count & Price */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="페이지 수"
            type="number"
            min={1}
            max={100}
            error={errors.pageCount?.message}
            {...register('pageCount', {
              required: '페이지 수를 입력해주세요.',
              min: {
                value: 1,
                message: '최소 1페이지 이상이어야 합니다.',
              },
              max: {
                value: 100,
                message: '최대 100페이지까지 가능합니다.',
              },
              valueAsNumber: true,
            })}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              가격 <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {PRICE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setValue('price', option.value)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedPrice === option.value
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Upload Progress */}
        {uploadProgress && (
          <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-primary-600 animate-spin" />
              <span className="text-primary-700 font-medium">{uploadProgress}</span>
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center justify-between pt-6 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(-1)}
          >
            취소
          </Button>
          <Button
            type="submit"
            loading={isSubmitting}
            disabled={!worksheetFile || !previewImage}
          >
            <Upload className="w-5 h-5 mr-2" />
            등록하기
          </Button>
        </div>
      </form>
    </div>
  );
}

export default UploadPage;
