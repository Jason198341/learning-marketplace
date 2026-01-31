export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          nickname: string;
          role: 'teacher' | 'parent' | 'admin';
          points: number;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          nickname: string;
          role?: 'teacher' | 'parent' | 'admin';
          points?: number;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          nickname?: string;
          role?: 'teacher' | 'parent' | 'admin';
          points?: number;
          avatar_url?: string | null;
          updated_at?: string;
        };
      };
      worksheets: {
        Row: {
          id: string;
          seller_id: string;
          title: string;
          description: string;
          price: number;
          grade: string;
          subject: string;
          category: string;
          tags: string[];
          file_url: string;
          preview_image: string;
          page_count: number;
          download_count: number;
          sales_count: number;
          average_rating: number;
          review_count: number;
          status: 'pending' | 'approved' | 'rejected';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          seller_id: string;
          title: string;
          description: string;
          price: number;
          grade: string;
          subject: string;
          category: string;
          tags?: string[];
          file_url: string;
          preview_image: string;
          page_count?: number;
          download_count?: number;
          sales_count?: number;
          average_rating?: number;
          review_count?: number;
          status?: 'pending' | 'approved' | 'rejected';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          description?: string;
          price?: number;
          grade?: string;
          subject?: string;
          category?: string;
          tags?: string[];
          file_url?: string;
          preview_image?: string;
          page_count?: number;
          download_count?: number;
          sales_count?: number;
          average_rating?: number;
          review_count?: number;
          status?: 'pending' | 'approved' | 'rejected';
          updated_at?: string;
        };
      };
      cart_items: {
        Row: {
          id: string;
          user_id: string;
          worksheet_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          worksheet_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          worksheet_id?: string;
        };
      };
      purchases: {
        Row: {
          id: string;
          buyer_id: string;
          worksheet_id: string;
          price: number;
          has_feedback: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          buyer_id: string;
          worksheet_id: string;
          price: number;
          has_feedback?: boolean;
          created_at?: string;
        };
        Update: {
          has_feedback?: boolean;
        };
      };
      feedbacks: {
        Row: {
          id: string;
          purchase_id: string;
          worksheet_id: string;
          buyer_id: string;
          rating: number;
          comment: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          purchase_id: string;
          worksheet_id: string;
          buyer_id: string;
          rating: number;
          comment: string;
          created_at?: string;
        };
        Update: {
          rating?: number;
          comment?: string;
        };
      };
      point_transactions: {
        Row: {
          id: string;
          user_id: string;
          type: 'signup_bonus' | 'purchase' | 'sale' | 'feedback_refund' | 'admin_charge';
          amount: number;
          balance: number;
          description: string;
          related_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: 'signup_bonus' | 'purchase' | 'sale' | 'feedback_refund' | 'admin_charge';
          amount: number;
          balance: number;
          description: string;
          related_id?: string | null;
          created_at?: string;
        };
        Update: never;
      };
    };
    Views: {
      worksheet_cards: {
        Row: {
          id: string;
          seller_id: string;
          seller_nickname: string;
          title: string;
          description: string;
          price: number;
          grade: string;
          subject: string;
          category: string;
          tags: string[];
          file_url: string;
          preview_image: string;
          page_count: number;
          download_count: number;
          sales_count: number;
          average_rating: number;
          review_count: number;
          status: string;
          created_at: string;
          updated_at: string;
        };
      };
    };
    Functions: {
      purchase_worksheets: {
        Args: { p_user_id: string };
        Returns: Json;
      };
      submit_feedback: {
        Args: {
          p_user_id: string;
          p_worksheet_id: string;
          p_rating: number;
          p_comment: string;
        };
        Returns: Json;
      };
    };
  };
}

// Helper types
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Worksheet = Database['public']['Tables']['worksheets']['Row'];
export type CartItem = Database['public']['Tables']['cart_items']['Row'];
export type Purchase = Database['public']['Tables']['purchases']['Row'];
export type Feedback = Database['public']['Tables']['feedbacks']['Row'];
export type PointTransaction = Database['public']['Tables']['point_transactions']['Row'];
export type WorksheetCard = Database['public']['Views']['worksheet_cards']['Row'];
